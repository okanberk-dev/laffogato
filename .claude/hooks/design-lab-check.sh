#!/bin/bash
# Stop hook for the design-lab skill (.claude/skills/design-lab): says when a
# design lab's temporary files are still in the tree. They are git-ignored,
# so they never reach a commit; this only reminds whoever ran the lab to
# finish or cancel it, which deletes them. Read-only, never blocks.
# The project's counterpart of the source plugin's cleanup-check.sh.

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

left=()
for p in .claude-design src/app/admin/design-lab src/app/admin/design-preview; do
  [ -e "$p" ] && left+=("$p")
done

[ ${#left[@]} -eq 0 ] && exit 0

printf '{"systemMessage":"[design-lab] Lab dosyaları duruyor: %s. Lab bitince ya da iptal edilince silinir."}\n' "${left[*]}"
exit 0
