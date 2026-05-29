# Skill Creator

引導設計 Claude Code Slash Command（`.claude/commands/*.md`），產生可直接使用的 skill 文件。

## 用法

```
/skill-creator [skill 描述]
```

範例：
- `/skill-creator` — 進入互動式設計流程
- `/skill-creator 建立一個自動 commit 並推送到遠端的 skill` — 快速產生指定 skill

## 互動流程

依序詢問以下問題，然後輸出完整 `.md` 文件：

1. **Skill 名稱**（英文，kebab-case，例：`auto-push`）
2. **觸發情境**（什麼時候用這個 command？）
3. **核心步驟**（numbered list，3-7 步）
4. **需要的工具**（Bash / Edit / Write / Read / Agent 等）
5. **輸出格式**（文字說明 / 程式碼 / 檔案 / 提問）
6. **注意事項**（邊界條件、安全限制）

## 輸出格式

```markdown
# [Skill 名稱]

[一句話描述]

## 用法

\`\`\`
/[skill-name] [可選參數]
\`\`\`

## 步驟

1. ...
2. ...

## 工具

- Bash: ...
- Edit: ...

## 注意事項

- ...
```

## 輸出後的下一步

告訴用戶：
```bash
# 儲存到專案 skills
cat > .claude/commands/[skill-name].md << 'EOF'
[生成的內容]
EOF
```

## 最佳實踐

- Skill 文件控制在 50 行以內
- 步驟要具體（包含實際指令），不要模糊描述
- 邊界條件要列出（不要讓 AI 猜測）
- 不要在 skill 裡再引用另一個 skill（避免遞歸混亂）

## 對應頁面

`skill-creator.html` — 視覺化 Skill 設計器（即時預覽）
