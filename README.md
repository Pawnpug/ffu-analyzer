# FFU Analyzer

## Why I Built This
I focused on a responsive UI customizable to user preferences, featuring an interactive chat with cited answers and a document viewer supporting both Excel and PDF formats. A Field Mode is included to improve usability on smaller devices when working on a construction site. A time line is also implemented to give a clear vision of the different dates that are important.
## Features

### Document Chat with Inline Citations
Ask questions about your documents in natural language. Every answer includes clickable inline citations:
- **Purple highlights** — quoted text with page number, click to jump to the exact location in the PDF
### Highlight & Add Context
Select any text in a document and press **E** to add it as context for your next chat message. This lets you ask follow-up questions about specific paragraphs or clauses.
### Document @-Mentions
Type **@** in the chat input to tag specific documents. The AI will prioritize those documents when answering.
### Field Mode
A simplified, larger interface designed for use on-site with tablets or laptops. Bigger text, fewer distractions — optimized for engineers reviewing documents out in the field.
### Timeline View
Automatically extracts and displays important dates from all documents — deadlines, decisions, project milestones — on a color-coded timeline. Click any event to navigate to its source document.
## What I Would Do Next
Given more time, I would integrate a Neo4j graph database to map relationships between documents — which documents reference each other, shared requirements across specs, and dependency chains. This would give users a clear visual overview of how the tender documents connect, making it easier to understand the full scope of a project and catch missing cross-references.
