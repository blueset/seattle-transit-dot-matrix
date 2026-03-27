#!/usr/bin/env python
"""Generate site data (fonts.json) and copy WOFF2 fonts for the showcase website."""

import json
import os
import shutil

FONTS = {
    "7":  {"name": "Seattle Transit Dot Matrix 7",  "dotHeight": 7,  "xHeight": 5,  "dir": "seattle_transit_7",  "description": "Secondary text on station platform displays"},
    "12": {"name": "Seattle Transit Dot Matrix 12", "dotHeight": 12, "xHeight": 8,  "dir": "seattle_transit_12", "description": "Link Light Rail train interior displays (newer cars)"},
    "14": {"name": "Seattle Transit Dot Matrix 14", "dotHeight": 14, "xHeight": 8,  "dir": "seattle_transit_14", "description": "Link Light Rail train interior displays (some cars)"},
    "15": {"name": "Seattle Transit Dot Matrix 15", "dotHeight": 15, "xHeight": 11, "dir": "seattle_transit_15", "description": "Link Light Rail station platforms"},
    "16": {"name": "Seattle Transit Dot Matrix 16", "dotHeight": 16, "xHeight": 11, "dir": "seattle_transit_16", "description": "Link Light Rail interior displays (older cars)"},
}

WOFF2_FILES = {
    "7":  "seattle_transit_dot_matrix_7.woff2",
    "12": "seattle_transit_dot_matrix_12.woff2",
    "14": "seattle_transit_dot_matrix_14.woff2",
    "15": "seattle_transit_dot_matrix_15.woff2",
    "16": "seattle_transit_dot_matrix_16.woff2",
}

# Duplicated from bin2ufo.py to avoid importing fontTools
unicode_map = {
    "bar": ord('|'), "colon": ord(':'), "lparen": ord('('),
    "rparen": ord(')'), "period": ord('.'), "slash": ord('/'),
    "space": ord(' '), "hairspace": 0x200A, "thinspace": 0x2009,
    "hyphen": ord('-'), "comma": ord(','),
}

def get_unicode(name):
    try:
        if len(name) == 1:
            return ord(name)
        elif len(name) == 2 and name[1] == "_":
            return ord(name[0])
        elif name[:2] == "U+":
            return int(name[2:], 16)
        else:
            return unicode_map[name]
    except (KeyError, ValueError):
        return None

lines_to_data = lambda lines: [list(map(lambda c: c == '1', list(line))) for line in lines]

def load_from_txt(path):
    characters = {}
    alternates = {}  # {set_name: {char_name: data}}
    for filename in sorted(os.listdir(path)):
        if not filename.endswith(".txt"):
            continue
        with open(f"{path}/{filename}") as fp:
            lines = fp.readlines()
        data = lines_to_data(map(str.strip, lines))
        if not data:
            continue
        components = filename.split(".")
        if len(components) == 3:
            character_name, stylistic_set, _ = components
            alternates.setdefault(stylistic_set, {})[character_name] = data
        elif len(components) == 2:
            character_name, _ = components
            characters[character_name] = data
    return characters, alternates


def make_glyph_entry(char_name, data):
    unicode_val = get_unicode(char_name)
    width = len(data[0]) if data else 0
    entry = {"width": width}
    if unicode_val is not None:
        entry["unicode"] = unicode_val
        entry["char"] = chr(unicode_val) if unicode_val < 0x110000 else char_name
    else:
        entry["char"] = char_name
    return entry

def build_font_data(font_id, font_info):
    characters, alternates = load_from_txt(font_info["dir"])
    glyphs = {}
    for char_name, data in characters.items():
        glyphs[char_name] = make_glyph_entry(char_name, data)

    # Stylistic alternates: {set_name: {char_name: glyph_entry}}
    alt_data = {}
    for set_name, chars in alternates.items():
        alt_data[set_name] = {}
        for char_name, data in chars.items():
            alt_data[set_name][char_name] = make_glyph_entry(char_name, data)

    result = {
        "name": font_info["name"],
        "dotHeight": font_info["dotHeight"],
        "xHeight": font_info["xHeight"],
        "description": font_info["description"],
        "woff2": WOFF2_FILES[font_id],
        "glyphs": glyphs,
    }
    if alt_data:
        result["alternates"] = alt_data
    return result


def main():
    site_dir = "site"
    fonts_dir = os.path.join(site_dir, "fonts")
    data_dir = os.path.join(site_dir, "data")
    os.makedirs(fonts_dir, exist_ok=True)
    os.makedirs(data_dir, exist_ok=True)

    # Copy WOFF2 files
    for font_id, woff2_name in WOFF2_FILES.items():
        src = os.path.join("out", woff2_name)
        dst = os.path.join(fonts_dir, woff2_name)
        if os.path.exists(src):
            shutil.copy2(src, dst)
            print(f"Copied {src} -> {dst}")
        else:
            print(f"Warning: {src} not found, skipping")

    # Generate fonts.json
    fonts_data = {"dotScale": 80, "fonts": {}}
    for font_id, font_info in FONTS.items():
        fonts_data["fonts"][font_id] = build_font_data(font_id, font_info)
        glyph_count = len(fonts_data["fonts"][font_id]["glyphs"])
        print(f"Font {font_id}: {glyph_count} glyphs")

    output_path = os.path.join(data_dir, "fonts.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(fonts_data, f, ensure_ascii=False)
    print(f"Written {output_path}")


if __name__ == "__main__":
    main()
