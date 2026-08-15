#!/usr/bin/env python3
"""Convert the WMS Google Sheets XLSX template to an atomic PostgreSQL reset/import."""

import re
import sys
import xml.etree.ElementTree as ET
import zipfile


NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}


def sql(value):
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def number(value, default="0"):
    try:
        return str(float(value))
    except (TypeError, ValueError):
        return default


def integer(value, default="0"):
    try:
        return str(int(float(value)))
    except (TypeError, ValueError):
        return default


def read_xlsx(path):
    archive = zipfile.ZipFile(path)
    shared = []
    if "xl/sharedStrings.xml" in archive.namelist():
        root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
        shared = [
            "".join(node.text or "" for node in item.iter(f"{{{NS['m']}}}t"))
            for item in root.findall("m:si", NS)
        ]

    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    relations = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    targets = {node.attrib["Id"]: node.attrib["Target"] for node in relations}
    sheets = {}
    for sheet in workbook.find("m:sheets", NS):
        target = targets[sheet.attrib[f"{{{NS['r']}}}id"]]
        if not target.startswith("xl/"):
            target = "xl/" + target.lstrip("/")
        root = ET.fromstring(archive.read(target))
        rows = []
        for row in root.findall(".//m:sheetData/m:row", NS):
            values = {}
            for cell in row.findall("m:c", NS):
                column = re.match(r"[A-Z]+", cell.attrib["r"]).group()
                value_node = cell.find("m:v", NS)
                value = "" if value_node is None else value_node.text
                if cell.attrib.get("t") == "s" and value:
                    value = shared[int(value)]
                elif cell.attrib.get("t") == "inlineStr":
                    value = "".join(
                        node.text or "" for node in cell.iter(f"{{{NS['m']}}}t")
                    )
                values[column] = value.strip() if isinstance(value, str) else value
            if any(str(value).strip() for value in values.values()):
                rows.append(values)
        sheets[sheet.attrib["name"]] = rows[1:]
    return sheets


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: import_google_template.py template.xlsx")
    sheets = read_xlsx(sys.argv[1])
    products = sheets.get("produk", [])
    locations = sheets.get("lokasi", [])
    customers = sheets.get("customer", [])

    print("BEGIN;")
    print(
        "TRUNCATE outbound_ayam, planning_ayam, relocation, planning_outbound, "
        "inbound_planning, stock_log, transaksi, stock, gudang, barang, customer, "
        "suplayer, login_log RESTART IDENTITY CASCADE;"
    )
    for row in products:
        sku = re.sub(r"\.0$", "", row.get("A", ""))
        name = row.get("B", "")
        if not sku or not name:
            continue
        unit = row.get("C", "") or "KG"
        category = (row.get("D", "") or "Dry").title()
        side = "FALSE" if category.lower() in ("wet", "waste") else "TRUE"
        print(
            "INSERT INTO barang (sku,nama,satuan,kategori,side,stok,min_stok,max_stok) "
            f"VALUES ({sql(sku)},{sql(name)},{sql(unit)},{sql(category)},{side},0,0,1000);"
        )
    for row in locations:
        name = row.get("A", "")
        if not name:
            continue
        zone = row.get("B", "") or "UNASSIGNED"
        side = "FALSE" if any(word in zone.upper() for word in ("WET", "CHILL", "FROZEN", "CS")) else "TRUE"
        print(
            "INSERT INTO gudang (name,zone,kolom,level,type,capacity,side,status) "
            f"VALUES ({sql(name)},{sql(zone)},{sql(row.get('C',''))},{integer(row.get('D'), '1')},"
            f"{sql(row.get('E','') or 'Single Deep')},{number(row.get('F'), '1000')},{side},TRUE);"
        )
    seen_customers = set()
    for row in customers:
        name = row.get("A", "")
        if not name or name.casefold() in seen_customers:
            continue
        seen_customers.add(name.casefold())
        print(
            "INSERT INTO customer (nama,alamat,telp,tipe) "
            f"VALUES ({sql(name)},{sql(row.get('B',''))},{sql(row.get('C',''))},{sql(row.get('D','') or 'customer')});"
        )
    print("COMMIT;")
    print(
        "SELECT 'barang='||(SELECT count(*) FROM barang)||', gudang='||(SELECT count(*) FROM gudang)||"
        "', customer='||(SELECT count(*) FROM customer) AS imported;"
    )


if __name__ == "__main__":
    main()
