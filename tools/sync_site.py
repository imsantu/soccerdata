#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把「重新生成的三份报告 HTML」里的数据块同步进静态站点。

设计原则（对应最初的需求「千万不要改动数据内容」）：
  * 只搬数据，绝不碰站点的外壳：site.js / site.css / 页面 JS / 页面 CSS / 字体 一律不动。
  * 写入前先备份旧文件到 automation/backups/<时间戳>/。
  * 写入前做体检，任何一条不通过就整批中止，一个字节都不写：
      1. 新旧顶层键集合必须一致
      2. 联赛数量、赛季（scope）键集合必须一致
      3. 历史赛季（非 2026-27）的场次必须一字不变 —— 防止误伤已完成赛季
      4. 2026-27 的场次只能增加不能减少 —— 进行中的赛季只会越赛越多
  * 序列化风格沿用目标文件现有的写法（draws 用带空格的默认风格，goals 用紧凑风格），
    避免每次运行产生无意义的整文件 diff。
"""

import json
import os
import re
import shutil
import sys
import time

WS = "/Users/santu/WorkBuddy AI/2026-09-02-02-18-19"
GOALS_WS = "/Users/santu/WorkBuddy AI/2026-08-24-11-07-48"
SITE = "/Users/santu/soccerdata/football-data-site"
AUTO = os.path.join(SITE, "tools")
BACKUP_DIR = os.path.join(AUTO, "backups")

CUR_SEASON = "2026-27"

JOBS = [
    {
        "name": "平局统计 · 五大联赛",
        "src": f"{WS}/football_big5_draws_report.html",
        "marker": "const DATA = ",
        "dst": f"{SITE}/assets/js/draws-big5-data.js",
        "kind": "draws",
    },
    {
        "name": "平局统计 · 次级联赛",
        "src": f"{WS}/football_champ_draws_report.html",
        "marker": "const DATA = ",
        "dst": f"{SITE}/assets/js/draws-champ-data.js",
        "kind": "draws",
    },
    {
        "name": "进球数统计",
        "src": f"{GOALS_WS}/football_en_goals_buckets_report.html",
        "marker": "window.DATA = ",
        "dst": f"{SITE}/assets/js/goals-data.js",
        "kind": "goals",
    },
]


def die(msg):
    print(f"[FAIL] {msg}")
    sys.exit(1)


def extract(path, marker):
    """从报告 HTML 里取出 marker 后面的那个 JSON 对象。"""
    s = open(path, encoding="utf-8").read()
    i = s.find(marker)
    if i < 0:
        die(f"{os.path.basename(path)} 里找不到数据标记 {marker!r}")
    obj, _ = json.JSONDecoder().raw_decode(s[i + len(marker):])
    return obj


def detect_separators(text, marker):
    """沿用目标文件现有的序列化风格：返回 json.dumps 的 separators 参数。"""
    i = text.find(marker)
    sample = text[i + len(marker): i + len(marker) + 4000]
    return None if '": ' in sample else (",", ":")


def season_rows(obj, kind):
    """产出 [(标签, 赛季, 场次)]，供历史赛季一致性校验。"""
    rows = []
    for lg in obj["leagues"]:
        tag = lg.get("cn") or lg.get("code")
        if kind == "draws":
            for season, sd in lg["seasons"].items():
                rows.append((f"{tag} {season}", season, sd.get("totalMatches")))
        else:
            for season, sc in lg["scopes"].items():
                rows.append((f"{tag} {season}", season, sc.get("totalMatches")))
    return rows


def main():
    stamp = time.strftime("%Y%m%d-%H%M%S")
    bdir = os.path.join(BACKUP_DIR, stamp)
    os.makedirs(bdir, exist_ok=True)

    planned = []          # [(job, new_text, summary_lines)]
    print("=== 体检阶段（此时尚未写入任何文件）===")

    for job in JOBS:
        src, dst, marker = job["src"], job["dst"], job["marker"]
        name = job["name"]
        if not os.path.exists(src):
            die(f"{name}: 源报告不存在 {src}")
        if not os.path.exists(dst):
            die(f"{name}: 站点数据文件不存在 {dst}")

        new = extract(src, marker)
        cur_text = open(dst, encoding="utf-8").read()
        old = extract(dst, marker)

        # 1) 顶层键一致
        if set(new) != set(old):
            die(f"{name}: 顶层键变化 {sorted(set(old) ^ set(new))}")

        # 2) 联赛数量一致
        if len(new.get("leagues", [])) != len(old.get("leagues", [])):
            die(f"{name}: 联赛数量变化 {len(old['leagues'])} -> {len(new['leagues'])}")

        # 2b) 赛季键一致
        key = "seasons" if job["kind"] == "draws" else "scopes"
        for a, b in zip(new["leagues"], old["leagues"]):
            if set(a[key]) != set(b[key]):
                die(f"{name} / {a.get('cn')}: 赛季键变化 {sorted(set(b[key]) ^ set(a[key]))}")

        # 3) 历史赛季必须一字不变  4) 2026-27 场次只能增不能减
        old_rows = dict((t, n) for t, s, n in season_rows(old, job["kind"]))
        changed = []
        for tag, season, n in season_rows(new, job["kind"]):
            o = old_rows.get(tag)
            if season == CUR_SEASON:
                if n is None or o is None:
                    continue
                if n < o:
                    die(f"{name} / {tag}: 场次倒退 {o} -> {n}")
                if n != o:
                    changed.append(f"    · {tag}: {o} -> {n} 场")
            else:
                if n != o:
                    die(f"{name} / {tag}: 历史赛季被改动 {o} -> {n}（禁止）")

        seps = detect_separators(cur_text, marker)
        body = marker + json.dumps(new, ensure_ascii=False, separators=seps) + ";"
        new_text = body + "\n" if cur_text.endswith("\n") else body

        same = new_text == cur_text
        print(f"  {name}: {'无变化' if same else '有更新'} "
              f"({os.path.getsize(dst):,} -> {len(new_text.encode('utf-8')):,} 字节)")
        for line in changed:
            print(line)

        shutil.copy2(dst, os.path.join(bdir, os.path.basename(dst)))
        planned.append((job, new_text, same))

    updatable = [p for p in planned if not p[2]]
    if not updatable:
        print("\n=== 三份数据均无变化，跳过写入 ===")
        print("SUMMARY|无变化")
        return

    print(f"\n=== 写入阶段（备份已存于 {bdir}）===")
    for job, new_text, _ in updatable:
        with open(job["dst"], "w", encoding="utf-8") as f:
            f.write(new_text)
        print(f"  [OK] 已写入 {job['dst']}")

    # 回读校验：确保写进去的东西还能被解析
    print("\n=== 回读校验 ===")
    for job, _, _ in updatable:
        obj = extract(job["dst"], job["marker"])
        n = len(obj.get("leagues", []))
        print(f"  [OK] {job['name']}: 解析成功，{n} 个联赛")

    cur_total = []
    for job in JOBS:
        obj = extract(job["dst"], job["marker"])
        for tag, season, n in season_rows(obj, job["kind"]):
            if season == CUR_SEASON:
                cur_total.append(f"{tag} {n}")
    print("SUMMARY|2026-27 已赛场次：" + "，".join(cur_total))


if __name__ == "__main__":
    main()
