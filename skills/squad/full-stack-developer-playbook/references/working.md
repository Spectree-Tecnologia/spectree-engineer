# Enquanto trabalha

<!-- moved verbatim from agents/full-stack-developer.md:66-78 (0.31.0) -->

## Enquanto trabalha

**Você é o único que escreve neste checkout**, na branch do objetivo, com o `.env` e o banco dele. A máquina é do fundador: mate só os processos que **você** subiu e anotou (pelo PID, nunca `taskkill /IM node.exe`); porta ocupada (`EADDRINUSE`) é para você trocar a sua porta, nunca para matar quem a segura. No Windows o `kill` do Git Bash deixa o `next start` vivo: pare servidor com `taskkill /PID <pid> /T /F`. Seus scripts e logs ficam em `.scratch/<slug>/full-stack-developer/` (com `BACKEND_LOG` e `FRONTEND_LOG` apontando para lá): log compartilhado é link mágico de outro agente lido por engano. E2e local sobe o backend com os mesmos limites elevados do passo Playwright do `ci.yml`, e roda em UTC (`TZ=UTC`), como o CI. Trabalho pela metade se guarda com um commit `wip` na sua branch: o painel recusa `git stash`. Se a missão te deu uma worktree (`npm run worktree -- up`, do platform-engineer), é porque outra coisa usa o checkout principal: use o `.env`, o banco e as portas dela, e nunca os do principal. Next lê `PORT` do processo, não do `.env`: `PORT=<porta do .env do frontend> npm run dev`. Você não dropa banco nem remove worktree: é do platform-engineer.

**Browser.** O browser do Playwright MCP é um só para a máquina. Quando a missão diz que outro agente o está usando, o screenshot e o teste de navegador saem de um script `playwright-core` no seu checkout, com perfil próprio.

**Missão curta.** Cada chamada de ferramenta relê o seu contexto inteiro. Quando o painel recusar uma chamada com o aviso de handoff: se falta pouco, termine; senão, commit, grave no seu ticket `Next needs:` com o que falta e o que você aprendeu, e relate `handoff`. Leia a parte do arquivo de que precisa, não o arquivo inteiro.

**Nada fica rodando.** Antes do relato, pare todo processo que você subiu (servidor, watcher como `nest start --watch` e `next dev` com os filhos deles, browser, `until … sleep` loop): pelo PID, e liste os PIDs parados no relato. Nunca espere em loop por um arquivo que outro processo escreve; rode o comando e leia a saída. Script vai para arquivo pelo Write tool e roda de lá: o painel recusa um interpretador lendo a stdin.

**Segredo nunca sai no relato.** Leia `.env` por nome (`grep -o '^[A-Z_]*=' .env`) ou com o valor cortado (`sed -n 's/=.*/=…/p' .env`); edite com `sed -i` sem ecoar; `cat`, `grep` ou `Read` numa linha com valor põe a chave na transcrição.

**Versão que o npm recusa** (`ETARGET` por `min-release-age`) não é para esperar: instale a mais nova que a janela aceita, diga no relato qual ficou de fora e por quantos dias.
