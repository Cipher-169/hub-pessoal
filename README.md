 <div align="center">

# 🎌 Hub de Animes

**Sua biblioteca pessoal para organizar, acompanhar e registrar suas experiências com animes.**

🔗 **[Acessar o projeto](https://cipher-169.github.io/hub-pessoal/)**

![Status](https://img.shields.io/badge/status-em%20desenvolvimento-ff916b?style=for-the-badge)
![AniList](https://img.shields.io/badge/integração-AniList-02A9FF?style=for-the-badge&logo=anilist&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-vanilla-f1c879?style=for-the-badge&logo=javascript&logoColor=111827)

</div>

<!-- Coloque aqui um print da tela principal: ![Print do site](img/print.png) -->

---

## ✨ Sobre o projeto

O **Hub de Animes** é um projeto pessoal desenvolvido para reunir e organizar minha experiência com animes em um só lugar.

A plataforma utiliza o **AniList** como fonte de informações do catálogo, enquanto oferece recursos próprios para registrar avaliações, acompanhar episódios, guardar comentários e organizar minhas experiências de visualização.

Mais do que uma lista de animes, a proposta é construir um arquivo pessoal de tudo aquilo que assisti, com registros e avaliações que representam minha própria experiência com cada obra.

## 🍿 Funcionalidades

**Biblioteca e acompanhamento**
- Integração com o AniList para sincronização do catálogo pessoal.
- Organização dos animes por status e progresso.
- Busca e visualização de informações dos títulos.
- Acesso direto à página individual de cada anime.
- Diário de episódios assistidos, com datas e comentários.

**Avaliações pessoais**
- Sistema de notas provisórias de 0 a 100.
- Notas definitivas independentes das avaliações provisórias.
- Histórico de alterações das notas definitivas.
- Comentários e primeiras impressões sobre os animes.

**Músicas de abertura e encerramento**
- Catálogo de openings (OP) e endings (ED).
- Integração com a AnimeThemes API.
- Avaliações individuais das músicas.
- Comentários pessoais sobre cada tema.
- Ranking musical e organização das melhores músicas.

**Estatísticas e rankings**
- Estatísticas pessoais sobre os animes assistidos.
- Ranking dos animes mais bem avaliados.
- Hall da fama de openings e endings.
- Histórico de avaliações e registros de episódios.

**Dados e gerenciamento**
- Exportação dos dados em JSON.
- Importação de backups com prévia dos registros.
- Identificação de novos registros, itens iguais e conflitos.
- Proteção contra sobrescrita de documentos existentes durante a importação.
- Cache local para reduzir consultas desnecessárias.

## ⭐ Um sistema de avaliações próprio

O Hub possui um sistema de notas de **0 a 100**, permitindo avaliações mais detalhadas e alinhadas à minha experiência com cada anime.

Existem duas categorias independentes:

- **Nota provisória:** uma avaliação pessoal que pode ser alterada livremente ao longo da experiência com a obra.
- **Nota definitiva:** uma avaliação consolidada, registrada separadamente e acompanhada por um histórico de revisões.

A nota definitiva não é substituída automaticamente quando a avaliação provisória muda. Isso permite preservar minha percepção final sobre uma obra, mesmo que minhas impressões iniciais tenham sido diferentes.

## 🧩 Tecnologias

- **HTML, CSS e JavaScript** (sem frameworks).
- **AniList GraphQL API** para informações e sincronização do catálogo.
- **AnimeThemes API** para catálogo de openings e endings.
- **Firebase Authentication** para autenticação com Google.
- **Cloud Firestore** para armazenamento dos dados.
- **IndexedDB** para persistência de cache local.
- **Cloudflare Workers** para intermediar a autenticação OAuth com o AniList.
- **GitHub Pages** para hospedagem.

A interface utiliza uma identidade visual própria, com tema escuro, fundo azul-marinho e destaques em laranja e dourado.

## 🔐 Segurança e privacidade

- A autenticação do proprietário é realizada pelo Firebase Authentication.
- As operações de escrita são protegidas por verificações de propriedade no código.
- A integração OAuth com o AniList utiliza um Cloudflare Worker para intermediar o fluxo de autenticação.
- O token de acesso do AniList não é armazenado diretamente no navegador.
- Os dados pessoais são organizados no Firestore, separados por usuário.

As permissões efetivas de leitura e escrita também dependem das regras de segurança configuradas no Firebase.

## 📌 Projeto relacionado

- **Hub de Filmes & Séries:** [https://github.com/Cipher-169/hub-series-filmes](https://github.com/Cipher-169/hub-series-filmes)

---

<div align="center">

Desenvolvido para transformar cada anime assistido em uma experiência registrada. 🎬

</div>
