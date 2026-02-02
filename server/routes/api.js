import { Router } from "express";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();
const router = Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

router.post("/analyze-prompt", async (req, res) => {
    const { prompt, userID, chatID } = req.body;
    
    // Input validation
    if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: "프롬프트가 필요합니다" });
    }
    
    if (prompt.length > 8000) {
        return res.status(400).json({ error: "프롬프트가 너무 깁니다 (최대 8000자)" });
    }
    
    // Validate userID if provided
    if (userID && typeof userID !== 'string') {
        return res.status(400).json({ error: "유효하지 않은 사용자 ID입니다" });
    }
    
    try {
        const sys = `다음 프롬프트를 태그별로 분석하고 JSON 형식으로 수정안을 제시해줘. 
형식: {"tags":[],"patches":{},"full_suggestion":""}`;
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: sys },
                { role: "user", content: prompt },
            ],
        });

        let parsed;
        try {
            parsed = JSON.parse(completion.choices[0].message.content);
        } catch (parseError) {
            console.error('JSON 파싱 실패:', parseError);
            console.error('OpenAI 응답:', completion.choices[0].message.content);
            return res.status(500).json({ error: "OpenAI 응답을 파싱할 수 없습니다" });
        }
        
        await supabase.from("analyses").insert({
            user_id: userID || "anonymous",
            chat_id: chatID || null,
            source_text: prompt,
            tags: parsed.tags,
            patches: parsed.patches,
            full_suggestion: parsed.full_suggestion,
        });

        res.json(parsed);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "분석 실패" });
    }
});

export default router;
