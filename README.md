# Personal Intelligence App: RAG-based Chatbot

A personal intelligence engine that turns your portfolio and experience into an interactive, context-aware conversational agent. It uses first-person perspective to answer questions about your background, projects, and experience as if it were you.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with dark/light theme support
- **AI Models**:
  - **LLM**: [Groq](https://groq.com/) (Llama-3.3-70b-versatile)
  - **Embeddings**: [Google Text-Embedding-004](https://ai.google.dev/)
- **Vector Database**: [DataStax Astra DB](https://astra.datastax.com/) (Serverless)
- **Scraper**: [Puppeteer](https://pptr.dev/)
- **Orchestration**: [LangChain.js](https://js.langchain.com/)
- **Streaming**: [Vercel AI SDK](https://sdk.vercel.ai/)

## System Architecture

![RAG System Architecture](./public/images/rag_architecture.png)

## How It Works

1. **Scraping** -- `scripts/scrape.ts` uses Puppeteer to crawl a target URL and extract clean text content.
2. **Ingestion** -- `scripts/loadDb.ts` splits text into chunks (1000 chars, 200 overlap), generates embeddings via Google, and stores them in Astra DB.
3. **Retrieval** -- When a user sends a message, the query is embedded and a vector similarity search retrieves the top 5 most relevant chunks from Astra DB.
4. **Generation** -- The retrieved context is injected into a system prompt and sent to the Groq LLM, which streams a persona-driven response back to the client.
5. **Citation** -- Source URLs from the matched documents are returned alongside the response for transparency.