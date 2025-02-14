# RAG (Retrieval-Augmented Generation) Chatbot (Coming Soon...)  

## Tech Stack
- **Puppeteer**: web scraper to collect relevent data 
- **Frontend**: Next.js (React, TypeScript, Tailwind CSS)  
- **Backend**: Node.js with DataStax Astra DB SDK for vector database integration  
- **LLM (Large Language Model)**: OpenAI API for text generation
  
## Workflow  
1. **User Query**: The user inputs a question into the chatbot interface  
2. **Retrieval**: The system searches relevant documents from the vector database using similarity search  
3. **Augmentation**: The retrieved context is added to the user query to improve response accuracy  
4. **Generation**: The enhanced query is sent to the OpenAI API to generate a relevant response  
5. **Response Delivery**: The chatbot presents the answer to the user  
