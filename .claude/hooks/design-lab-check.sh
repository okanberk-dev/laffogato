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

# The lab's temporary Tailwind source line (SKILL.md "Lab rotası").
grep -q "DESIGN-LAB TEMP" src/app/globals.css 2>/dev/null &&
  left+=("src/app/globals.css (geçici @source satırı)")

[ ${#left[@]} -eq 0 ] && exit 0

printf '{"systemMessage":"[design-lab] Lab dosyaları duruyor: %s. Lab bitince ya da iptal edilince silinir; hiçbiri commit edilmez."}\n' "${left[*]}"
exit 0
