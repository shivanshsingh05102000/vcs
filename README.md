# VCS — A Git-Inspired Version Control System

A lightweight, Git-like version control system built from scratch in Node.js. Supports branching, merging, staging, and commit history — all stored in a `.vcs` directory using SHA-256 hashing and zlib compression.

---

## Installation

```bash
git clone https://github.com/shivanshsingh05102000/vcs.git
cd vcs
npm install
npm link
```

After `npm link`, the `vcs` command is available globally in your terminal.

---

## Commands

### `vcs init`
Initialize a new repository in the current directory.
```bash
vcs init
```
Creates a `.vcs/` directory with the object store, refs, and HEAD.

---

### `vcs add <filename>`
Stage a file for the next commit.
```bash
vcs add app.js
```
Hashes the file content and writes it to the object store. Updates the staging index.

---

### `vcs commit -m "<message>"`
Commit staged changes with a message.
```bash
vcs commit -m "initial commit"
```
Builds a tree object from the index and creates a commit object pointing to it.

---

### `vcs status`
Show staged, unstaged, and untracked files.
```bash
vcs status
```

---

### `vcs log`
Print the commit history for the current branch.
```bash
vcs log
```

---

### `vcs branch <name>`
Create a new branch pointing to the current commit.
```bash
vcs branch feature
```

---

### `vcs checkout <branch|hash>`
Switch to a branch or a specific commit.
```bash
vcs checkout feature
vcs checkout a3f2d1e
```
Restores the working directory to match the target commit. Supports detached HEAD.

---

### `vcs merge <branch>`
Merge another branch into the current branch.
```bash
vcs merge feature
```
Performs a fast-forward merge if possible. Falls back to a 3-way merge using the Lowest Common Ancestor (LCA). Conflict markers are written inline:
```
<<<<<<< HEAD
your changes
=======
incoming changes
>>>>>>> incoming
```
Fix conflicts manually, then run `vcs commit -m "merge commit"`.

---

## How It Works

| Concept | Implementation |
|---|---|
| Object store | Files stored in `.vcs/objects/<2-char-prefix>/<rest-of-hash>` |
| Hashing | SHA-256 via Node's `crypto` module |
| Compression | zlib deflate/inflate |
| Blob | Raw file content |
| Tree | Maps filenames → blob hashes |
| Commit | Points to a tree + optional parent + metadata |
| Refs | Branch pointers stored as plain text in `.vcs/refs/heads/` |
| HEAD | Stores current branch ref or commit hash (detached) |

---

## Tech Stack

- **Runtime:** Node.js
- **Hashing:** Node `crypto` (SHA-256)
- **Compression:** Node `zlib`
- **No frameworks — zero runtime dependencies beyond `js-sha256`**

---

## Project Structure

```
vcs/
├── cli.js              # Entry point, command router
├── commands/
│   ├── init.js
│   ├── add.js
│   ├── commit.js
│   ├── status.js
│   ├── log.js
│   ├── branch.js
│   ├── checkout.js
│   └── merge.js
├── lib/
│   ├── objects.js      # Blob/tree/commit read & write
│   ├── refs.js         # HEAD and branch ref management
│   ├── index.js        # Staging area (JSON)
│   ├── diff.js         # Line-level diff
│   └── merge.js        # LCA finder + 3-way merge
└── test/
    ├── objects.test.js
    ├── diff.test.js
    └── merge.test.js
```

---
## References
- [Pro Git Book](https://git-scm.com/book/en/v2) — used to understand Git's internal object model

---

## Author

Shivansh Singh — [GitHub](https://github.com/shivanshsingh05102000/vcs)
