# Coem visualizer
This is part of the Coem project in this part I'm trying to visualize all classical short stories and poems into an embeddings map.
The english version is coming and the poem embeddings of almost 5000 poems are also comming.

Visualize it here [Coem](https://estevefact.github.io)

# Limits
the color are only for 50 categories at maximum

## Explanation
These are 3092 short stories all under 7 minutes long approximately  an scraped and annotated by me, wikipedia and the 
help of some LLMs. I embedded these stories using one of the best open source models for Spanish classification and 
extraction with high enough input tokens so that the entire story would fit that I could find at that moment.
All stories are in spanish originally. I used full open source models and computers (including GPUS) that were all free 
as a self limitation. I used Pinecone as a VectorDB. Thank you open source people and free trials or amounts per month!! 

# Models used:
- Translation: NLLB
- Sentence transformer: jina-embeddings-v2-base-es
- LLM: Phi-3 
- TTS: Openvoice and Metavoice to generate the audios

# Coming soon
I Generated a Carl Sagan Voice with an openvoice model and I'm generating an mp3 file for each story, this will be 
uploaded to youtube and also have a separate website where one can explore, comment, rate and subscribe to listen to this
stories in a customized way; like adding their own voice or how they want the story to be like or how hard it is to read.
All these stories are also being translated and an english speaking version is also on the works. There's also
a visualization of the newtork of authors that's on the works, one could also analyze with categories too. 

# Contribute
If anyone want to contribute please Push a PR, or send me an email mostly the excel file of coem_authors_enriched inside
tensor_generator needs more attention. Need to turn them into csv, json or parquet to be eassily monitored. Finetuning 
the translation to make them really available would be really great.
