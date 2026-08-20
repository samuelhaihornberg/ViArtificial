import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();
const app = express();

// Autorise ton interface HTML à communiquer avec ce serveur
app.use(cors()); 
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/chat', async (req, res) => {
    try {
        // Définition d'un comportement système complexe pour l'IA
        const systemPrompt = "Tu es ViA, un chatbot expert en coaching et planification. Réponds toujours de manière concise, structure tes réponses, et inclus toujours un '💡 Conseil Coaching Friendly' à la fin.";
        
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            systemInstruction: systemPrompt 
        });
        
        const result = await model.generateContent(req.body.prompt);
        res.json({ reponse: result.response.text() });
    } catch (error) {
        console.error("Erreur serveur:", error);
        res.status(500).json({ erreur: "Erreur de connexion au cerveau ViA." });
    }
});

app.listen(process.env.PORT, () => console.log(`Serveur ViA en ligne sur le port ${process.env.PORT} 🚀`));
