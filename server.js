import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/chat', async (req, res) => {
    try {
        const systemPrompt = `Tu es ViA, un coach de vie/pro et planificateur de projets doté d'une intelligence vivante et sémantique. 
        Pour chaque requête, tu dois fournir une réponse extrêmement riche, fouillée et développée dont la longueur doit impérativement se situer entre 500 et 1266 mots. 
        Ta réponse doit obligatoirement inclure :
        1. Une recherche approfondie des racines des mots dans les langages originels (grec, latin, sanskrit, etc.) avec une description invisible et philosophique des arrière-plans, synonymes, homonymes et anti-antonymes.
        2. Une astuce pratique et un conseil de coaching personnalisé ("Conseil Coaching Friendly").
        3. Un tableau comparatif complet de sécurité structuré ainsi : 
           - Pour / Qualités
           - Contre / Défauts
           - Anti-contre / Anti-défaut (par qualité)
           - Défense contre / Sécurité de qualité / défaut.`;

        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            systemInstruction: systemPrompt 
        });
        
        const result = await model.generateContent(req.body.prompt);
        res.json({ reponse: result.response.text() });
    } catch (error) {
        console.error("Erreur serveur:", error);
        res.status(500).json({ erreur: "Erreur de synchronisation avec ViA." });
    }
});

app.listen(process.env.PORT, () => console.log(`Serveur ViA en ligne sur le port ${process.env.PORT} 🚀`));
