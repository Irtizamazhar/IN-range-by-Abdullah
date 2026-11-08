// Classify only the legacy tables/name differences documented in DATABASE_MIGRATIONS.md.
// Generated difference SQL is inspection data, never an execution plan.
export function classifyCatalogDrift(sql, foreignKeys, indexes) {
  const statements = sql.replace(/^\s*--.*$/gm, '').split(';').map(s => s.trim()).filter(Boolean);
  const legacy = new Set(['wantpost', 'wantofferlegacy20260914']);
  const droppedTables = [], droppedKeys = [], addedKeys = [], droppedIndexes = [], addedIndexes = [], unexpected = [];
  const key = (table, name) => table + '/' + name.toLowerCase();
  const columns = text => text.split(',').map(s => s.trim().replace(/`/g, ''));
  const rule = text => text === 'NO ACTION' ? 'RESTRICT' : text;
  const fk = new Map(), ix = new Map();
  for (const row of foreignKeys) {
    const id = key(row.TABLE_NAME, row.CONSTRAINT_NAME);
    if (!fk.has(id)) fk.set(id, []);
    fk.get(id).push(row);
  }
  for (const row of indexes) {
    const id = key(row.TABLE_NAME, row.INDEX_NAME);
    if (!ix.has(id)) ix.set(id, []);
    ix.get(id).push(row);
  }
  for (const statement of statements) {
    let m;
    if ((m = /^DROP TABLE `([^`]+)`$/i.exec(statement))) {
      if (legacy.has(m[1])) droppedTables.push(m[1]); else unexpected.push('Undocumented extra table: ' + m[1]);
    } else if ((m = /^ALTER TABLE `([^`]+)` DROP FOREIGN KEY `([^`]+)`$/i.exec(statement))) droppedKeys.push({ table: m[1], name: m[2] });
    else if ((m = /^ALTER TABLE `([^`]+)` ADD CONSTRAINT `([^`]+)` FOREIGN KEY \(([^)]+)\) REFERENCES `([^`]+)`\(([^)]+)\) ON DELETE (SET NULL|CASCADE|RESTRICT|NO ACTION) ON UPDATE (SET NULL|CASCADE|RESTRICT|NO ACTION)$/i.exec(statement))) addedKeys.push({ table: m[1], name: m[2], columns: columns(m[3]), parent: m[4], parentColumns: columns(m[5]), deleteRule: m[6], updateRule: m[7] });
    else if ((m = /^DROP INDEX `([^`]+)` ON `([^`]+)`$/i.exec(statement))) droppedIndexes.push({ table: m[2], name: m[1] });
    else if ((m = /^CREATE (UNIQUE )?INDEX `([^`]+)` ON `([^`]+)`\((.+)\)$/i.exec(statement))) {
      const parts = m[4].split(',').map(s => /^\s*`([^`]+)`(?:\((\d+)\))?(?:\s+(ASC|DESC))?\s*$/i.exec(s));
      if (parts.some(p => !p)) unexpected.push('Unsupported index expression on ' + m[3]);
      else addedIndexes.push({ table: m[3], name: m[2], unique: Boolean(m[1]), columns: parts.map(p => ({ name: p[1], prefix: p[2] ? Number(p[2]) : null, direction: p[3]?.toUpperCase() === 'DESC' ? 'D' : 'A' })) });
    } else unexpected.push('Undocumented schema operation: ' + statement.slice(0, 100));
  }
  for (const added of addedKeys) {
    const dropped = droppedKeys.find(row => row.table === added.table && row.name.toLowerCase() === added.name.toLowerCase());
    const actual = (fk.get(key(added.table, added.name)) || []).sort((a, b) => Number(a.ORDINAL_POSITION) - Number(b.ORDINAL_POSITION));
    if (!dropped || !actual.length || JSON.stringify(actual.map(r => r.COLUMN_NAME)) !== JSON.stringify(added.columns) || actual.some((r, i) => r.REFERENCED_TABLE_NAME !== added.parent || r.REFERENCED_COLUMN_NAME !== added.parentColumns[i] || rule(r.DELETE_RULE) !== rule(added.deleteRule) || rule(r.UPDATE_RULE) !== rule(added.updateRule))) unexpected.push('Foreign-key semantics differ: ' + added.table + '/' + added.name);
  }
  for (const dropped of droppedKeys) if (!legacy.has(dropped.table) && !addedKeys.some(row => row.table === dropped.table && row.name.toLowerCase() === dropped.name.toLowerCase())) unexpected.push('Unpaired foreign-key removal: ' + dropped.table + '/' + dropped.name);
  for (const added of addedIndexes) {
    const dropped = droppedIndexes.find(row => row.table === added.table && row.name.toLowerCase() === added.name.toLowerCase());
    const actual = (ix.get(key(added.table, added.name)) || []).sort((a, b) => Number(a.SEQ_IN_INDEX) - Number(b.SEQ_IN_INDEX));
    const shape = actual.map(row => ({ name: row.COLUMN_NAME, prefix: row.SUB_PART == null ? null : Number(row.SUB_PART), direction: row.COLLATION || 'A' }));
    if (!dropped || !actual.length || Boolean(Number(actual[0].NON_UNIQUE) === 0) !== added.unique || JSON.stringify(shape) !== JSON.stringify(added.columns)) unexpected.push('Index semantics differ: ' + added.table + '/' + added.name);
  }
  for (const dropped of droppedIndexes) if (!addedIndexes.some(row => row.table === dropped.table && row.name.toLowerCase() === dropped.name.toLowerCase())) unexpected.push('Unpaired index removal: ' + dropped.table + '/' + dropped.name);
  return { documentedDifferencesOnly: unexpected.length === 0, preservedLegacyTables: droppedTables, capitalizationOnlyForeignKeyPairs: addedKeys.length, capitalizationOnlyIndexPairs: addedIndexes.length, unexpected, warning: 'Preserve legacy tables and existing names. Never execute the generated difference SQL.' };
}
