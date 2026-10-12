# Raio-X Arquitetônico — Casa de campo (térrea, em "U")

Apresentação 3D interativa da casa, reconstruída a partir da planta baixa, das fachadas e da ficha geradas por IA.
React + Vite + TypeScript + Three.js (React Three Fiber + Drei) + Zustand. Interface 100% em português.

> Visualização arquitetônica. Elementos não documentados são estimativos. Não substitui projeto técnico.

## Como rodar

```bash
npm install
npm run dev        # desenvolvimento (http://localhost:5173)
npm run build      # typecheck + build de produção em dist/
npm run preview    # serve o build
npm run typecheck  # só TypeScript
npm test           # 28 testes de lógica (modelo, linha do tempo, corte, explosão, etc.)
```

Requer Node 18+. Abra com `?debug` na URL para expor `window.__raiox` (estado da aplicação) no console.

## Como navegar

| Ação | Como |
|---|---|
| Visões | Geral · Planta · Corte · Instalações · Interior (barra superior ou teclas **1–5**) |
| Órbita / zoom / pan | mouse (esquerdo / roda / direito) ou toque |
| Linha do tempo | Espaço = play/pause · ←/→ = etapa anterior/próxima · arraste a barra · velocidade 0,5×–3× · reiniciar |
| Raio-X | **X** (e controle de opacidade no painel Camadas) |
| Explodir | **E** (slider de distância no painel Camadas) |
| Legendas | **L** |
| Painel lateral | **[** abre/fecha · **C** = salvar PNG · **?** = ajuda |
| Interior | arraste para olhar; o botão "Capturar mouse" ativa o pointer lock (só por clique explícito). **WASD**/setas andam (Shift corre); **Esc** ou "Voltar à vista externa" sai. No celular: joystick + área de olhar |

Painéis: **Camadas** (alvenaria, esquadrias, estrutura, cobertura, instalações, mobiliário… + presets Tudo/Arquitetura/Estrutura/Instalações), **Corte** (eixo X/Y/Z, posição, inverter, resetar), **Locais** (lista navegável de cômodos e elementos), **Inspeção** (dados do elemento clicado), **Ajustes** (imagem de referência e opacidade, calibração, parâmetros estimados, hipóteses, importar/exportar JSON, restaurar padrão).

### Linha do tempo (40 s)
1 Fundação → 2 Estrutura → 3 Instalações → 4 Fechamento → 5 Finalização. É determinística e reversível: o estado de cada elemento é função pura do progresso, então arrastar a barra para trás desfaz exatamente o que foi construído.

## Modelo de dados (fonte única da verdade)

Tudo vem de `src/data/house/casa-de-campo.json`: paredes (com aberturas), ambientes, telhados, estrutura, mobiliário, instalações, revestimentos, paisagismo, anotações e `assumptions` (hipóteses). A cena 3D, a planta 2D, as listas e a inspeção são derivadas dele (`src/data/house/derive.ts`). Principais campos:

- `params` — espessuras, pé-direito (2,80), cumeeira (4,90), beiral, altura de portas…
- `walls[]` — `{ id, name, kind: ext|int|mid|muro, a:[x,z], b:[x,z], t, openings[] }`
- `rooms[]` — polígonos (m) com piso, área calculada e cota nominal
- `roofs[]` — planos definidos por pontos e inclinação
- `structure`, `furniture[]`, `systems`, `cladding[]`, `landscape`
- cada item tem `src`: `confirmado` · `estimado` · `esquematico` (aparece na inspeção)

Convenções: 1 unidade = 1 m; X leste, Z sul (frente = +Z), Y para cima; origem no canto noroeste externo.

**Importar/exportar:** painel Ajustes → Dados do modelo → Exportar JSON / Importar JSON (validado antes de aplicar; erros listados em PT-BR). **Persistência:** `localStorage` (`raiox-casa:v1`) guarda ajustes, modelo importado e preferências; "Restaurar padrão" limpa tudo.

### Trocar a planta / imagem de referência
Substitua `public/assets/planta.png` (ou aponte `reference.image` do JSON para outro arquivo) e atualize `reference.sizePx`, `originPx` e `mPerPx`. Se a escala estiver errada, use **Calibração**: informe uma distância conhecida (m) entre dois pontos da planta e o modelo reescala.

### Ajustar medidas
Painel Ajustes → Parâmetros estimados: espessuras, beiral, inclinação do volume central, cores. Alterações são sobrescritas por cima do modelo-base e reconstroem a cena. Medidas estruturais do desenho, se conhecidas, são mais fáceis de corrigir editando o JSON (ou re-gerando com `tools/build_house.py`).

## Hipóteses e conflitos (resumo)
H-01 alturas das paredes calculadas pelo telhado · H-02 espessuras estimadas · H-03 planta com escalas X≠Z · H-04 cotas internas divergem do desenho (até ~0,8 m) · H-05 cotas laterais somam 10,00 m ≠ 12,20 m (prevaleceu a total) · H-06 hall sem passagem desenhada → porta estimada · H-07 inclinações (10% na cobertura × ≈17% p/ chegar a 4,90 m) · H-08 fundação/pilares/cintas/caibros esquemáticos · H-09 instalações esquemáticas · H-10 mobiliário aproximado · H-11 peitoris/vergas · H-12 muro do pátio e paisagismo vêm da ficha/fachadas. A lista completa está no painel Ajustes → Hipóteses e conflitos.

## Arquitetura do código

```
src/data/house/   modelo, tipos, validação, derivação (alturas, colisão, ambientes)
src/data/config.ts etapas, camadas, presets, iluminação, qualidade
src/scene/build/  geometrias (paredes com vãos reais, telhado, estrutura, instalações, mobiliário, terreno)
src/scene/animation/apply.ts  estado determinístico por (progresso, camadas, raio-X, explosão, corte, modo)
src/scene/cameras/  poses, órbita/planta, primeira pessoa com colisão
src/state/        Zustand + persistência
src/components/   viewer (R3F) e interface (React/CSS)
tests/            testes de lógica (npm test)
```

### Gráficos (WebGL2 · Three.js)
Tudo roda em **WebGL2** pelo Three.js (React Three Fiber), sem imagens externas:
- **Materiais PBR procedurais** (`src/scene/build/textures.ts`): reboco, ripado/frisos de madeira com veios e nós, telha *standing seam* com nervuras, concreto com juntas, pisos, cascalho. Cada textura gera **cor + normal map (Sobel) + mapa de rugosidade** a partir da mesma função de altura (≈1–1,5 s na abertura).
- **Céu e horizonte:** no fundo "Céu" (padrão), um céu em degradê equiretangular gera também o mapa de ambiente (PMREM), então reflexos e luz indireta combinam com o fundo; o chão continua até o horizonte e some na **neblina** na mesma cor. Fundo "Estúdio" = cinza neutro como nas imagens de referência (painel Camadas → Cena → Fundo).
- **Sombras:** mapa de 2048 (Média) / 4096 (Alta) com borda suavizada (PCF + raio).
- **Pós-processamento** (`@react-three/postprocessing`, `Post.tsx`): Média = oclusão de ambiente N8AO em meia resolução + SMAA; Alta = N8AO alto + **bloom** sutil (lâmpadas, brilho do sol) + vinheta leve + SMAA. Desligado na Planta e no Corte (o AO ignora o plano de recorte). A captura PNG passa pelo mesmo compositor.
- **Vidro:** na Alta usa transmissão física (refração/fresnel com o ambiente); nas outras, vidro translúcido mais leve.
- **Interior:** a luz de ambiente é reduzida dentro de casa para não "lavar" os cômodos; pendentes pretos sobre a mesa de jantar (como nas fotos), luminárias com brilho.
- **Modelagem:** fáscia metálica no telhado, coroamento do muro, mobiliário com bordas arredondadas, plantas de vaso com folhas.
- **Paisagismo** (`vegetation.ts`, `site.ts`): canteiros com borda de aço e cascalho, arbustos cinza-esverdeados, touceiras e oliveiras feitos de centenas de folhas instanciadas. Dados em `landscape.beds` / `landscape.plants` (gerados por `tools/build_house.py`).

Desempenho: `frameloop="demand"` (só renderiza quando algo muda), DPR adaptativo, qualidade Baixa/Média/Alta (também cai sozinha se os quadros ficarem lentos), geometrias mescladas/instanciadas, descarte completo de recursos ao reconstruir. Se o WebGL falhar ou o contexto for perdido, aparece a planta 2D de fallback.

## Limitações conhecidas
- **Corte:** é um plano de recorte real (eixo/posição/inversão), mas **sem tampa** (não preenche a seção); os sólidos são desenhados nos dois lados.
- **Captura PNG:** só do canvas 3D, sem a interface.
- **Estrutura e instalações são esquemáticas** (não vêm da planta); não servem para obra.
- A planta gerada por IA tem inconsistências de cota (H-03 a H-05); a calibração e os parâmetros existem para corrigi-las quando você tiver medidas reais.
- Calhas simplificadas; sem pós-processamento (SSAO etc.); mobiliário em geometria simples (agora com bordas suaves, mas ainda sem modelos importados).
- O chunk JS tem ~1,3 MB (gzip ~370 KB), por causa do Three.js.
- Testes automatizados cobrem a lógica (modelo, timeline, explosão, corte, seleção, reconstrução). A parte visual foi verificada manualmente em capturas (desktop e mobile), não por testes de imagem.

## Verificação (última execução)
`tsc --noEmit` sem erros · `npm test`: 28 passaram, 0 falharam · `vite build` ok.
