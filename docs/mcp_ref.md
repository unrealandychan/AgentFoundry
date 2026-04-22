Top 30 MCP servers (with Figma, DeepWiki, etc.)
Name Category JSON config snippet
Name Category JSON config snippet
filesystem Dev tools {"command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","/path/to/your/code"]}
git Dev tools {"command":"uvx","args":["mcp-server-git","--repository","/path/to/your/repo"]}
github Dev tools {"command":"npx","args":["-y","@modelcontextprotocol/server-github"],"env":{"GITHUB_PERSONAL_ACCESS_TOKEN":"${GITHUB_TOKEN}"}}
gitlab	Dev tools	{"command":"npx","args":["-y","@modelcontextprotocol/server-gitlab"],"env":{"GITLAB_TOKEN":"${GITLAB_TOKEN}"}}
filesystem-local Dev tools {"command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","/Users/you/project"]}
postgres Databases {"command":"npx","args":["-y","@modelcontextprotocol/server-postgres","postgresql://USER:PASSWORD@HOST:5432/appdb"]}
supabase Databases {"command":"npx","args":["-y","@modelcontextprotocol/server-supabase","https://YOUR-PROJECT.supabase.co"],"env":{"SUPABASE_KEY":"${SUPABASE_KEY}"}}
mysql	Databases	{"command":"npx","args":["-y","@modelcontextprotocol/server-mysql","mysql://USER:PASSWORD@HOST:3306/appdb"]}
mongo	Databases	{"command":"npx","args":["-y","@modelcontextprotocol/server-mongo","mongodb://localhost:27017/appdb"]}
redis	Databases	{"command":"npx","args":["-y","@modelcontextprotocol/server-redis","redis://localhost:6379"]}
fetch	Web / RAG	{"command":"npx","args":["-y","@modelcontextprotocol/server-fetch"]}
firecrawl	Web / RAG	{"command":"npx","args":["-y","@modelcontextprotocol/server-firecrawl"],"env":{"FIRECRAWL_API_KEY":"${FIRECRAWL_API_KEY}"}}
tavily-search Search / RAG {"command":"npx","args":["-y","@modelcontextprotocol/server-tavily-search"],"env":{"TAVILY_API_KEY":"${TAVILY_API_KEY}"}}
exa-search	Search / RAG	{"command":"npx","args":["-y","@modelcontextprotocol/server-exa-search"],"env":{"EXA_API_KEY":"${EXA_API_KEY}"}}
brave-search Search / RAG {"command":"npx","args":["-y","@modelcontextprotocol/server-brave-search"]}
notion Productivity {"command":"npx","args":["@ramidecodes/mcp-server-notion@latest","-y","--api-key=${NOTION_API_KEY}"]}
google-workspace Productivity {"command":"npx","args":["-y","@modelcontextprotocol/server-gmail","-y","@modelcontextprotocol/server-drive"],"env":{"GOOGLE_CLIENT_ID":"${GOOGLE_CLIENT_ID}","GOOGLE_CLIENT_SECRET":"${GOOGLE_CLIENT_SECRET}"}}
slack Productivity {"command":"npx","args":["-y","@modelcontextprotocol/server-slack"],"env":{"SLACK_BOT_TOKEN":"${SLACK_BOT_TOKEN}"}}
linear	Productivity	{"command":"npx","args":["-y","@modelcontextprotocol/server-linear"],"env":{"LINEAR_API_KEY":"${LINEAR_API_KEY}"}}
attio CRM {"command":"npx","args":["-y","@modelcontextprotocol/server-attio"],"env":{"ATTIO_API_KEY":"${ATTIO_API_KEY}"}}
salesforce	CRM	{"command":"npx","args":["-y","@modelcontextprotocol/server-salesforce"],"env":{"SALESFORCE_TOKEN":"${SALESFORCE_TOKEN}"}}
hubspot CRM {"command":"npx","args":["-y","@modelcontextprotocol/server-hubspot"],"env":{"HUBSPOT_API_KEY":"${HUBSPOT_API_KEY}"}}
aws	Cloud	{"command":"npx","args":["-y","@modelcontextprotocol/server-aws"],"env":{"AWS_ACCESS_KEY_ID":"${AWS_ACCESS_KEY_ID}","AWS_SECRET_ACCESS_KEY":"${AWS_SECRET_ACCESS_KEY}"}}
google-cloud	Cloud	{"command":"npx","args":["-y","@modelcontextprotocol/server-gcloud"],"env":{"GCP_CREDENTIALS_PATH":"${GCP_CREDENTIALS_PATH}"}}
kubernetes Cloud {"command":"npx","args":["-y","@modelcontextprotocol/server-kubernetes"],"env":{"KUBERNETES_CONFIG_PATH":"${KUBECONFIG_PATH}"}}
figma	UI / Design	{"command":"npx","args":["-y","figma-developer-mcp","--figma-api-key=${FIGMA_API_KEY}","--stdio"]}
deepwiki Search / RAG {"command":"npx","args":["-y","deepwiki-mcp"],"env":{"DEEPWIKI_MAX_CONCURRENCY":"5","DEEPWIKI_REQUEST_TIMEOUT":"30000","DEEPWIKI_MAX_RETRIES":"3","DEEPWIKI_RETRY_DELAY":"250"}}
playwright Browser / automation {"command":"npx","args":["-y","@modelcontextprotocol/server-playwright"]}
zapier Productivity / automation {"command":"npx","args":["-y","@modelcontextprotocol/server-zapier"],"env":{"ZAPIER_API_KEY":"${ZAPIER_API_KEY}"}}
composio	General / hub	{"command":"npx","args":["-y","composio-core","mcp"],"env":{"COMPOSIO_API_KEY":"${COMPOSIO_API_KEY}"}}
