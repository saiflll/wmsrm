const fs = require('fs');
const path = require('path');

const MAPPINGS = [
    { name: 'rm', map: 'C:/Users/Lenovo/Documents/dev/app/wms/rm/backend_rename_mapping.json', frontend: 'C:/Users/Lenovo/Documents/dev/app/wms/rm/rm/frontend' },
    { name: 'fg', map: 'C:/Users/Lenovo/Documents/dev/app/wms/fg/backend_rename_mapping.json', frontend: 'C:/Users/Lenovo/Documents/dev/app/wms/fg/fg/frontend' },
    { name: 'integrate', map: 'C:/Users/Lenovo/Documents/dev/app/wms/integrate/backend_rename_mapping.json', frontend: 'C:/Users/Lenovo/Documents/dev/app/wms/integrate/frontend' },
];

for (const p of MAPPINGS) {
    let map = {};
    try { map = JSON.parse(fs.readFileSync(p.map, 'utf8')); } catch (e) { console.log(p.name, 'no mapping', e.message); continue; }
    console.log(`\n== ${p.name}: mapping keys=${Object.keys(map).length} ==`);

    // Get entity/DTO field-like names: those ending in common entity field suffixes or containing Indonesian/domain words
    const fieldLike = ['Id', 'Name', 'Date', 'Time', 'Qty', 'No', 'Code', 'At', 'User', 'Status', 'Role', 'Key', 'Token', 'Data', 'List', 'Type', 'In', 'Out', 'Total', 'Login', 'Kayla', 'Bagus', 'Shift'];
    // Simpler: entity fields are identifiers that appear in entity.ts files. We can't easily know here.
    // Heuristic: exclude ones that end with Repo/Service/Module/Controller/Guard.
    const candidates = Object.keys(map).filter(k => !/(Repo|Service|Module|Controller|Guard|Strategy|Interceptor|Filter|Pipe|Factory|Record|Table|Row|Column|Seeder|App|Logger|Repo)$/.test(k));
    console.log(`candidate field-like: ${candidates.length}`);
    console.log(candidates.slice(0, 40).join(', '));
}