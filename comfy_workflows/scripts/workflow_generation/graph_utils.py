"""
graph_utils.py — graph helpers every workflow handler shares (AUDIT D6).

They used to be copied into each generate_*.py: the title lookup ten times, the prune
five, the switch bake three. These are the guards that stop a shipped graph from
silently running the wrong branch, so a fix to one copy has to reach every handler.
"""


def find_by_title(workflow: dict, title: str) -> dict | None:
    """The node whose `_meta.title` is `title`, or None."""
    for node in workflow.values():
        if isinstance(node, dict) and node.get("_meta", {}).get("title") == title:
            return node
    return None


def find_id_by_title(workflow: dict, title: str) -> str | None:
    """The id of the node whose `_meta.title` is `title`, or None."""
    for nid, node in workflow.items():
        if isinstance(node, dict) and node.get("_meta", {}).get("title") == title:
            return nid
    return None


def prune_to_captures(workflow: dict, capture_titles: tuple[str, ...]) -> None:
    """Drop every node not upstream of one of `capture_titles`.

    The authoring bench leaves orphans behind: dead Set channels, per-branch preview taps,
    A/B comparers, spare preprocessors with an unconnected required input. ComfyUI only
    validates nodes reachable from an output, so they are harmless on the bench, but in a
    shipped graph they are dead weight, can force extra node-pack deps, and make
    `missing-required` checks noisy, which trains people to ignore them."""
    caps = [nid for t in capture_titles if (nid := find_id_by_title(workflow, t))]
    if not caps:
        raise SystemExit(f"[FAIL] none of {capture_titles} present — nothing to capture, "
                         f"the app would receive no output from this graph")
    keep: set[str] = set()

    def walk(nid: str) -> None:
        if nid in keep or nid not in workflow:
            return
        keep.add(nid)
        for v in workflow[nid]["inputs"].values():
            if isinstance(v, list) and len(v) == 2 and isinstance(v[0], str):
                walk(v[0])

    for nid in caps:
        walk(nid)
    dropped = [nid for nid in workflow if nid not in keep]
    for nid in dropped:
        del workflow[nid]
    if dropped:
        print(f"  [PRUNE] dropped {len(dropped)} bench node(s) not upstream of "
              f"{'/'.join(capture_titles)}")


def bake_int(workflow: dict, title: str, value: int, tag: str, missing: str) -> None:
    """A titled MpiInt the app injects into must exist and be a PLAIN WIDGET, never a
    link — then bake it to `value`.

    This is the one-file template's central footgun (MPI-365). If the node is gone, or
    driven by a link, the injection lands on nothing the graph reads and it runs whatever
    branch the upstream produces: a plausible image from the WRONG op or tier, which reads
    as a model quality problem rather than a wiring bug.

    The bake matters because the AUTHORING graph holds whatever branch the user was last
    testing. An un-baked template ships that as the fallback, and it only shows through
    when injection fails — exactly when a wrong branch is hardest to spot.

    `missing` says what the graph loses without the node; it ends the failure message."""
    node = find_by_title(workflow, title)
    if node is None:
        raise SystemExit(f"[FAIL] no node titled {title!r} — {missing}")
    if isinstance(node["inputs"].get("int"), list):
        raise SystemExit(f"[FAIL] {title}.int is linked, not a widget — the app injects "
                         f"into it, so a link makes the injection a silent no-op")
    before = node["inputs"].get("int")
    node["inputs"]["int"] = value
    if before != value:
        print(f"  [{tag}] {title}.int: {before!r} -> {value}")
