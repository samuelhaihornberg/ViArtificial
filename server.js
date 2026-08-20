import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// Charge les variables du fichier .env
dotenv.config();

const app = express();
app.use(express.json());

// Initialise l'IA avec la clé sécurisée
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// La route qui reçoit les requêtes de ton front-end Coff
app.post('/api/chat', async (req, res) => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(req.body.prompt);
        res.json({ reponse: result.response.text() });
    } catch (error) {
        res.status(500).json({ erreur: error.message });
    }
});

app.listen(process.env.PORT, () => {
    console.log(`Le cerveau est en ligne sur le port ${process.env.PORT} 🚀`);
});
