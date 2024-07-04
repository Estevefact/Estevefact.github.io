# Coem visualizer
This is part of the Coem project and in this part I'm trying to visualize all classical short stories and poems into an embeddings map.
The english version is coming and the poem embeddings of almost 5000 poems are also comming. The links Visualization was done thanks
to the help of @AgustinVallejo!

Visualize the embeddings here [Coem embeddings](https://estevefact.github.io) and the links here [Coem Links](https://estevefact.github.io/authorToAuthor3D.html)


# Limits
the color are only for 50 categories at maximum

## Explanation
I wanted to be able to see the stories that I liked, which authors I had read and hering them from Carls voice to explore eevruything the classical literature that I love has!! so I did this for me and for anyone else who also wants to explore Classical Literature. Also eassily get to know new authors or stories similar to what they already like or know, which in my case, took some time to read the recommendation from the prologue or by reading wikipedia, so hope this helps but jkeep exploring and reaidng wikipedia and the books directly please!
These are 3092 short stories all under 8 minutes long approximately  an scraped and annotated by me, wikipedia and the 
help of some LLMs. I embedded these stories using one of the best open source models for Spanish classification and 
extraction with high enough input tokens so that the entire story would fit that I could find at that moment.
All stories are in spanish originally. I used full open source models and computers (including GPUS) that were all free 
as a self limitation. I used Pinecone as a VectorDB. The Author LInks was created using the Wikipedia API and seeing 
which other authors were mentioned, some of the authors coulnd't get scraped by a wikipedia page so there is still work 
to be done.
Thank you open source people, literature databases in spanish that are too old like amediavoz.com
 and free trials or amounts per month for making this possible!! 

# Models used:
- Translation: NLLB
- Sentence transformer: jina-embeddings-v2-base-es
- LLM: Phi-3 
- TTS: Openvoice and Metavoice to generate the audios

# Coming soon
I Generated a Carl Sagan Voice with an openvoice model and I'm generating an mp3 file for each story, this will be 
uploaded to youtube and added as a columns to the embeddings and also have a separate website where one can explore,
comment, rate and subscribe to listen to this stories in a customized way. I'm also doing an embeddings for all teh poms
I have and adding them to the website to be read without audio for now. After that, the customization would be like 
adding their own voice or how they want the story to be like or how hard it is to read. All these stories are also
being translated on an english speaking version on the works which is not completetly great but is decent.

# Contribute
If anyone want to contribute please Push a PR, or send me an email mostly the tsv and [json](authorLinksSmaller.json)
containing the metadata file of [stories_metadata.tsv](tensor_generator/stories_metadata.tsv) inside tensor_generator 
needs more attention. Need to turn them into csv, json or parquet to be eassily monitored. Finetuning 
the translation to make them really available would be really great.

[![Donate with PayPal button](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/donate?hosted_button_id=F43U7EFMW5N2A)

