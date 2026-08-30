async function test() {
  const mod = await import('@sqlite.org/sqlite-wasm');
  console.log('default type:', typeof mod.default);
  console.log('default keys:', mod.default ? Object.keys(mod.default) : 'N/A');
  
  const s3 = await mod.default({
    print: (m) => console.log('[print]', m),
    printErr: (m) => console.error('[printErr]', m),
  });
  console.log('s3 type:', typeof s3);
  console.log('s3 keys:', Object.keys(s3));
  console.log('s3.oo1 keys:', s3.oo1 ? Object.keys(s3.oo1) : 'no oo1');
  console.log('s3.oo1.DB:', typeof s3.oo1?.DB);
  
  const db = new s3.oo1.DB('test-db');
  console.log('db created:', !!db);
  
  db.exec("CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, name TEXT)");
  db.exec("INSERT INTO test (name) VALUES ('hello')");
  
  const stmt = db.prepare("SELECT * FROM test");
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.get({}));
  }
  stmt.finalize();
  console.log('rows:', rows);
  
  db.close();
}

test().catch(console.error);
