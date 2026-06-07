# 3Q Hatchery — 部署捷徑
# 用法：make / make push / make richmenu / make worker / make token / make pages

.PHONY: all push richmenu worker pages token help

all: ## git push（→ 觸發 deploy.yml Action 自動部署）
	@./deploy.sh all

push: ## 只做 git add / commit / push
	@./deploy.sh gh

richmenu: ## 上傳 3 版 Rich Menu（需 CHANNEL_TOKEN）
	@./deploy.sh richmenu

worker: ## 本機 wrangler deploy（需 wrangler + CF 登入）
	@./deploy.sh worker

pages: ## 印出 GitHub Pages 素材 URL
	@./deploy.sh pages

token: ## 互動式設定 CHANNEL_TOKEN（需 source 才能帶進 shell）
	@printf '請貼上 LINE Channel Access Token（long-lived）：' ; \
	read -r t ; \
	echo "" ; \
	echo "在目前 shell 執行下列指令以套用：" ; \
	echo "  export CHANNEL_TOKEN=\"$$t\""

help: ## 顯示可用指令
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'
