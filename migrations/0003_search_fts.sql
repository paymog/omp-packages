CREATE VIRTUAL TABLE packages_fts USING fts5(name, description, content='packages', tokenize='trigram');
INSERT INTO packages_fts (rowid, name, description) SELECT rowid, name, description FROM packages;

CREATE TRIGGER packages_fts_insert AFTER INSERT ON packages BEGIN
  INSERT INTO packages_fts (rowid, name, description) VALUES (new.rowid, new.name, new.description);
END;
CREATE TRIGGER packages_fts_delete AFTER DELETE ON packages BEGIN
  INSERT INTO packages_fts (packages_fts, rowid, name, description) VALUES ('delete', old.rowid, old.name, old.description);
END;
CREATE TRIGGER packages_fts_update AFTER UPDATE OF name, description ON packages BEGIN
  INSERT INTO packages_fts (packages_fts, rowid, name, description) VALUES ('delete', old.rowid, old.name, old.description);
  INSERT INTO packages_fts (rowid, name, description) VALUES (new.rowid, new.name, new.description);
END;
