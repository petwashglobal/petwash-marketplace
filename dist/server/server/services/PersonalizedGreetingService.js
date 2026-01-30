/**
 * Pet Wash™ - Personalized AI Greeting Service
 *
 * Generates personalized greetings using Gemini 2.5 Flash based on:
 * - User's birthday
 * - Israeli/Jewish holidays (Hebcal API)
 * - Time of day (morning, late night)
 * - User's preferred language (Hebrew/English)
 *
 * Hebcal API: FREE Jewish calendar & Israeli holidays
 * https://www.hebcal.com/home/developer-apis
 */
import { GoogleGenAI } from "@google/genai";
import { logger } from '../lib/logger';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
// ============================================
// HEBCAL API CLIENT (FREE Israeli Holidays)
// ============================================
export class HebcalClient {
    static BASE_URL = 'https://www.hebcal.com/hebcal';
    static CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
    static todayHolidaysCache = null;
    /**
     * Check if today is an Israeli/Jewish holiday
     * Uses FREE Hebcal REST API
     */
    static async checkIfTodayIsHoliday() {
        try {
            const today = new Date();
            const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD
            // Check cache
            if (this.todayHolidaysCache && this.todayHolidaysCache.date === todayString) {
                const holiday = this.todayHolidaysCache.holidays[0];
                if (holiday) {
                    return {
                        isHoliday: true,
                        holidayName: holiday.title,
                        holidayNameHebrew: holiday.hebrew
                    };
                }
                return { isHoliday: false };
            }
            // Fetch from Hebcal API
            const currentYear = today.getFullYear();
            const currentMonth = today.getMonth() + 1; // 1-12
            const params = new URLSearchParams({
                v: '1',
                cfg: 'json',
                year: currentYear.toString(),
                month: currentMonth.toString(),
                maj: 'on', // Major holidays
                min: 'on', // Minor holidays
                mod: 'on', // Modern Israeli holidays
                nx: 'on', // Rosh Chodesh
                i: 'on', // Israeli calendar (not Diaspora)
                lg: 'h' // Hebrew language titles
            });
            const url = `${this.BASE_URL}?${params.toString()}`;
            const response = await fetch(url);
            if (!response.ok) {
                logger.warn('[Hebcal] API request failed', { status: response.status });
                return { isHoliday: false };
            }
            const data = await response.json();
            // Filter for today's holidays
            const todayHolidays = data.items.filter(item => item.date === todayString);
            // Cache result
            this.todayHolidaysCache = {
                date: todayString,
                holidays: todayHolidays
            };
            if (todayHolidays.length > 0) {
                const holiday = todayHolidays[0];
                logger.info('[Hebcal] Today is a holiday!', {
                    name: holiday.title,
                    hebrew: holiday.hebrew
                });
                return {
                    isHoliday: true,
                    holidayName: holiday.title,
                    holidayNameHebrew: holiday.hebrew || holiday.title
                };
            }
            return { isHoliday: false };
        }
        catch (error) {
            logger.error('[Hebcal] Error checking holidays', { error });
            return { isHoliday: false };
        }
    }
}
// ============================================
// OCCASION DETECTION
// ============================================
export async function determineOccasion(userData) {
    const currentDate = new Date();
    const currentHour = currentDate.getHours();
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    const currentDay = currentDate.getDate();
    // 1. Check for Birthday
    if (userData.dateOfBirth) {
        try {
            const dobMatch = userData.dateOfBirth.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (dobMatch) {
                const birthMonth = parseInt(dobMatch[2], 10); // 1-12
                const birthDay = parseInt(dobMatch[3], 10);
                if (birthMonth === currentMonth && birthDay === currentDay) {
                    logger.info('[PersonalizedGreeting] Birthday detected!', {
                        user: userData.name,
                        birthDate: `${birthMonth}/${birthDay}`
                    });
                    return { occasion: "Birthday" };
                }
            }
        }
        catch (error) {
            logger.warn('[PersonalizedGreeting] Error parsing dateOfBirth', { error });
        }
    }
    // 2. Check for Israeli/Jewish Holiday
    const holidayCheck = await HebcalClient.checkIfTodayIsHoliday();
    if (holidayCheck.isHoliday) {
        const holidayName = userData.preferredLanguage === 'he'
            ? (holidayCheck.holidayNameHebrew || holidayCheck.holidayName)
            : holidayCheck.holidayName;
        logger.info('[PersonalizedGreeting] Holiday detected!', { holidayName });
        return {
            occasion: "Major Holiday",
            occasionDetails: holidayName
        };
    }
    // 3. Check for Time of Day
    if (currentHour >= 22 || currentHour < 5) { // 10 PM - 5 AM
        return { occasion: "Late Night Login" };
    }
    if (currentHour >= 5 && currentHour < 12) { // 5 AM - 12 PM
        return { occasion: "Morning Login" };
    }
    // 4. Default
    return { occasion: "Standard Greeting" };
}
// ============================================
// AI GREETING GENERATION
// ============================================
export async function getPersonalizedGreeting(userData) {
    try {
        // Detect occasion
        const { occasion, occasionDetails } = await determineOccasion(userData);
        // Prepare system instruction (language-specific)
        const systemInstruction = userData.preferredLanguage === 'he'
            ? `אתה Kenzo, הגולדן רטריבר הלבן המקסים של Pet Wash™️! 🐾 תפקידך ליצור ברכות קצרות ואישיות למשתמשים. תמיד פנה למשתמש בשמו ובשפה המבוקשת. היה חם, ידידותי ומקצועי. אל תהיה ארוך מדי - 1-2 משפטים בלבד!`
            : `You are Kenzo, the adorable white Golden Retriever of Pet Wash™️! 🐾 Your job is to create short, personalized greetings for users. Always address the user by name in the requested language. Be warm, friendly, and professional. Keep it brief - 1-2 sentences only!`;
        // Build prompt based on occasion
        let occasionContext = '';
        if (occasion === 'Birthday') {
            occasionContext = userData.preferredLanguage === 'he'
                ? `היום יום ההולדת של המשתמש! ברך אותו בחום רב.`
                : `Today is the user's birthday! Wish them warmly.`;
        }
        else if (occasion === 'Major Holiday' && occasionDetails) {
            occasionContext = userData.preferredLanguage === 'he'
                ? `היום חג: ${occasionDetails}. ברך אותו בהתאם לחג.`
                : `Today is a holiday: ${occasionDetails}. Wish them accordingly.`;
        }
        else if (occasion === 'Late Night Login') {
            occasionContext = userData.preferredLanguage === 'he'
                ? `המשתמש מתחבר מאוחר בלילה. איחול לילה טוב יהיה מתאים.`
                : `User is logging in late at night. A good night wish is appropriate.`;
        }
        else if (occasion === 'Morning Login') {
            occasionContext = userData.preferredLanguage === 'he'
                ? `המשתמש מתחבר בבוקר. איחול בוקר טוב יהיה מתאים.`
                : `User is logging in in the morning. A good morning wish is appropriate.`;
        }
        else {
            occasionContext = userData.preferredLanguage === 'he'
                ? `ברכה רגילה וידידותית.`
                : `Standard friendly greeting.`;
        }
        const prompt = userData.preferredLanguage === 'he'
            ? `צור ברכה קצרה ואישית (1-2 משפטים בלבד):
שם המשתמש: ${userData.name}
שפה: עברית
הקשר: ${occasionContext}

דוגמאות קצרות:
- "היי ${userData.name}! 🐾 שמח לראות אותך היום!"
- "שלום ${userData.name}! 🎉 מזל טוב ליום ההולדת שלך!"
- "${userData.name}, לילה טוב! 🌙 נעים לראות אותך גם בשעות המאוחרות!"

צור ברכה דומה, קצרה ומקורית:`
            : `Create a short, personalized greeting (1-2 sentences only):
User's Name: ${userData.name}
Language: English
Context: ${occasionContext}

Short examples:
- "Hi ${userData.name}! 🐾 Great to see you today!"
- "Hello ${userData.name}! 🎉 Happy Birthday!"
- "${userData.name}, good night! 🌙 Nice to see you even at this late hour!"

Create a similar, short, original greeting:`;
        // Call Gemini 2.5 Flash
        const model = ai.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction
        });
        const result = await model.generateContent(prompt);
        const greetingText = result.response.text().trim();
        logger.info('[PersonalizedGreeting] Generated greeting', {
            user: userData.name,
            language: userData.preferredLanguage,
            occasion,
            greetingLength: greetingText.length
        });
        return greetingText;
    }
    catch (error) {
        logger.error('[PersonalizedGreeting] Error generating greeting', { error });
        // Fallback greetings
        if (userData.preferredLanguage === 'he') {
            return `שלום ${userData.name}! 🐾 ברוכים הבאים ל-Pet Wash™!`;
        }
        else {
            return `Welcome back, ${userData.name}! 🐾`;
        }
    }
}
// ============================================
// MAIN FUNCTION (App Launch)
// ============================================
/**
 * Get and display personalized greeting upon app launch
 * This is the main function to call from the client
 */
export async function getAndDisplayPersonalizedGreeting(userData) {
    return await getPersonalizedGreeting(userData);
}
