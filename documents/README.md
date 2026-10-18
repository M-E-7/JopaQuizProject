# documents/

Put the source documents to generate questions from here (.docx, .csv, ...).

`npm --prefix app run ingest -- documents/<file>` extracts a document's text into `extracted/<file>.md` and `.json`, with the locations that question references use.

**Everything in this folder except this README is gitignored.** The repo is public, so source documents are never committed.
