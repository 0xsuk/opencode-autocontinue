GitHub操作はMCPを使わず、必ずCLI（`gh`）で行う。

PR作成時の基本手順:

1. 差分確認: `git status --short`, `git diff --name-only`, `git log --oneline <base>..HEAD`
2. リモート追従確認: `git branch -vv`
3. 必要ならpush: `git push -u origin <branch>`
4. PR作成: `gh pr create --title "..." --body "..."`
5. 最後にPR URLを返す: `gh pr view --json url -q .url`

他者レビューコメントの取得:

- PR会話コメント（Issue comments）: `gh pr view <number> --comments`
- インラインレビューコメント: `gh api repos/{owner}/{repo}/pulls/<number>/comments`
- レビューイベント（APPROVED/CHANGES_REQUESTED含む）: `gh api repos/{owner}/{repo}/pulls/<number>/reviews`

URLを渡された場合の扱い:

- まず `gh pr view <url>` を使い、必要に応じて `gh api` で補完する。

注意:

- ユーザーから明示依頼がない限り `git push` はしない。
- 取得結果は生出力を貼りすぎず、要点を要約して返す。
