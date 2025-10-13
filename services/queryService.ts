import { supabase } from "../lib/supabase";
import { Phone } from "../types";
import { GoogleGenAI } from "@google/genai";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
}

export interface QueryResult {
  phones: Phone[];
  query: string;
  queryDescription: string;
  isVague?: boolean;
  followUpSuggestions?: string[];
  totalResults?: number;
}

export interface MultipleQueryResult {
  phones: Phone[];
  queries: Array<{
    queryString: string;
    phonesFound: number;
  }>;
  totalResults: number;
  isVague?: boolean;
  isAdversarial?: boolean;
  isIrrelevant?: boolean;
  followUpSuggestions?: string[];
  extractedValues?: string[]; // Add extracted database values
}

class QueryService {
  private genAI: GoogleGenAI;

  constructor() {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_AI_API_KEY is not defined");
    }
    this.genAI = new GoogleGenAI({ apiKey });
  }

  // Extract database queryable values from chat history and current query
  private extractDatabaseQueryValues(
    userQuery: string,
    chatHistory?: ChatMessage[]
  ): string[] {
    const values: string[] = [];
    const allText = chatHistory
      ? [...chatHistory.map((msg) => msg.content), userQuery].join(" ")
      : userQuery;

    // Extract price values (under, below, less than, max, budget)
    const priceMatches = allText.match(
      /(?:under|below|less than|max|budget|upto|up to)\s*(?:₹|rs\.?|rupees?)?\s*(\d+(?:,\d{3})*(?:k|thousand)?)/gi
    );
    if (priceMatches) {
      priceMatches.forEach((match) => {
        const price = match.match(/(\d+(?:,\d{3})*(?:k|thousand)?)/i)?.[1];
        if (price) {
          const numericPrice = price.includes("k")
            ? parseInt(price.replace(/[,\s]/g, "")) * 1000
            : parseInt(price.replace(/[,\s]/g, ""));
          if (numericPrice > 0) values.push(`price <= ${numericPrice}`);
        }
      });
    }

    // Extract brand values
    const brands = [
      "samsung",
      "apple",
      "iphone",
      "oneplus",
      "xiaomi",
      "redmi",
      "realme",
      "oppo",
      "vivo",
      "google",
      "pixel",
      "motorola",
      "nokia",
    ];
    brands.forEach((brand) => {
      if (allText.toLowerCase().includes(brand)) {
        values.push(`brand = ${brand}`);
      }
    });

    // Extract RAM values
    const ramMatches = allText.match(
      /(\d+)\s*(?:gb|gigabytes?)\s*(?:ram|memory)/gi
    );
    if (ramMatches) {
      ramMatches.forEach((match) => {
        const ram = match.match(/(\d+)/)?.[1];
        if (ram) values.push(`ram = ${ram}GB`);
      });
    }

    // Extract storage values
    const storageMatches = allText.match(
      /(\d+)\s*(?:gb|tb|gigabytes?|terabytes?)\s*(?:storage|memory)/gi
    );
    if (storageMatches) {
      storageMatches.forEach((match) => {
        const storage = match.match(/(\d+)/)?.[1];
        if (storage) values.push(`storage = ${storage}GB`);
      });
    }

    // Extract camera values
    const cameraMatches = allText.match(
      /(\d+)\s*(?:mp|megapixels?)\s*(?:camera|rear|back)/gi
    );
    if (cameraMatches) {
      cameraMatches.forEach((match) => {
        const camera = match.match(/(\d+)/)?.[1];
        if (camera) values.push(`camera_main >= ${camera}MP`);
      });
    }

    // Extract battery values
    const batteryMatches = allText.match(/(\d+)\s*(?:mah|mAh|milliampere)/gi);
    if (batteryMatches) {
      batteryMatches.forEach((match) => {
        const battery = match.match(/(\d+)/)?.[1];
        if (battery) values.push(`battery >= ${battery}mAh`);
      });
    }

    // Extract display size values
    const displayMatches = allText.match(
      /(\d+(?:\.\d+)?)\s*(?:inch|inches|")/gi
    );
    if (displayMatches) {
      displayMatches.forEach((match) => {
        const size = match.match(/(\d+(?:\.\d+)?)/)?.[1];
        if (size) values.push(`display_size = ${size}"`);
      });
    }

    // Extract OS values
    if (allText.toLowerCase().includes("android")) values.push(`os = Android`);
    if (allText.toLowerCase().includes("ios")) values.push(`os = iOS`);

    // Extract rating values
    const ratingMatches = allText.match(
      /(?:rating|rated)\s*(?:above|over|more than)?\s*(\d+(?:\.\d+)?)/gi
    );
    if (ratingMatches) {
      ratingMatches.forEach((match) => {
        const rating = match.match(/(\d+(?:\.\d+)?)/)?.[1];
        if (rating) values.push(`rating >= ${rating}`);
      });
    }

    // Remove duplicates
    return [...new Set(values)];
  }
  // Generate and execute multiple queries for comprehensive coverage
  async generateAndExecuteMultipleQueries(
    userQuery: string,
    chatHistory?: ChatMessage[]
  ): Promise<MultipleQueryResult> {
    try {
      console.log("AI Agent received user query:", userQuery);
      console.log("Generating multiple AI-powered Supabase queries...");

      // Use AI to generate multiple database queries
      const queryInfo = await this.generateMultipleAIQueries(
        userQuery,
        chatHistory
      );

      console.log(
        "AI Generated Queries:",
        queryInfo.queries.map((q) => q.queryString)
      );

      // Execute all queries in parallel
      const allPhones = await this.executeMultipleSupabaseQueries(
        queryInfo.queries
      );

      // Check if query is vague based on number of distinct database queryable values
      // 1 value = vague (needs more specificity), 2+ values = not vague
      const extractedValues = this.extractDatabaseQueryValues(
        userQuery,
        chatHistory
      );
      const isVague = extractedValues.length === 1;

      console.log("Extracted database values:", extractedValues);
      console.log("Is vague (1 value):", isVague);
      const followUpSuggestions = undefined; // AI will handle vague queries intelligently

      return {
        phones: allPhones, // Always return phones (even for vague queries - AI will show top 5)
        queries: queryInfo.queries.map((q) => ({
          queryString: q.queryString,
          phonesFound: 0, // Will be updated by executeMultipleSupabaseQueries
        })),
        totalResults: allPhones.length,
        isVague,
        isAdversarial: queryInfo.isAdversarial,
        isIrrelevant: queryInfo.isIrrelevant,
        followUpSuggestions,
        extractedValues, // Include extracted database values
      };
    } catch (error) {
      console.error("AI Multiple Query generation/execution error:", error);
      return {
        phones: [],
        queries: [],
        totalResults: 0,
        isVague: false,
      };
    }
  }

  private async generateMultipleAIQueries(
    userQuery: string,
    chatHistory?: ChatMessage[]
  ): Promise<{
    queries: Array<{
      queryString: string;
      description: string;
      queryConditions: Array<{
        field: string;
        operator: string;
        value: string | number | string[];
      }>;
    }>;
    isAdversarial?: boolean;
    isIrrelevant?: boolean;
  }> {
    const prompt = `
You are a database query expert for a mobile phone database. Analyze the user's query and generate MULTIPLE Supabase queries for comprehensive coverage.

      Database schema:
      - Table: phones
      - Columns: id, brand, model, price, release_year, os, ram, storage, display_type, display_size, resolution, refresh_rate, camera_main, camera_front, camera_features, battery, charging, processor, connectivity, sensors, features, weight, dimensions, rating, stock_status, category, colours

      IMPORTANT SEARCH RULES:
      - BRAND COLUMN: Use for company names (Samsung, Apple, OnePlus, Xiaomi, Realme, Oppo, Vivo, Google)
      - MODEL COLUMN: Use for specific phone models and series (Galaxy S24, iPhone 15, Redmi Note 12, etc.)
      - SERIES DETECTION: Use regex patterns for series (S series = S + number, A series = A + number, etc.)
      - RESULT LIMITING: Each query returns max 10 phones sorted by rating (highest first)
      - VAGUE DETECTION: Generate 1 query = vague (needs specificity), 2+ queries = not vague
      - SMART QUERIES: Generate focused queries that return relevant phones
      - QUALITY FOCUS: Each query shows top-rated phones for better recommendations

      ${
        chatHistory && chatHistory.length > 0
          ? `
      ## CHAT HISTORY CONTEXT
      Previous conversation context:
      ${chatHistory.map((msg) => `- ${msg.role}: ${msg.content}`).join("\n")}
      
      Use this context to understand what the user is looking for and generate more relevant queries.
      `
          : ""
      }

      User Query: "${userQuery}"

First, analyze the query:
1. Is this query about mobile phones? (yes/no)
2. Is this query adversarial/inappropriate? (yes/no)
3. Generate SMART Supabase database queries - only generate additional queries if they add meaningful value

Generate queries intelligently based on query complexity:
- Simple queries (e.g., "phones under 30k"): Generate 1 focused query ONLY
- Specific queries (e.g., "Samsung phones under 30k"): Generate 1 targeted query ONLY  
- Complex queries (e.g., "best gaming phones under 30k"): Generate 2 queries MAXIMUM
- Comparison queries (e.g., "iPhone vs Samsung"): Generate 2 queries MAXIMUM

CRITICAL RULES:
- Each query MUST be different and non-overlapping
- Generate multiple queries ONLY when absolutely necessary
- Each query should return < 50 phones sorted by rating if required
- Avoid redundant or similar queries

Examples of intelligent query generation:
- Query: "phones under 30k" → Generate: ["phones under ₹30,000 with rating >= 4.0"] (1 query ONLY)
- Query: "Samsung phones under 30k" → Generate: ["Samsung phones under ₹30,000 with rating >= 4.0"] (1 query ONLY)
- Query: "best gaming phones under 30k" → Generate: ["phones under ₹30,000 with gaming features", "high-rated gaming phones under ₹30,000"] (2 queries MAX)
- Query: "iPhone vs Samsung" → Generate: ["iPhone phones with rating >= 4.0", "Samsung phones with rating >= 4.0"] (2 queries MAX)

IMPORTANT: Generate maximum 3 queries. Focus on quality over quantity.

Respond with ONLY a JSON object:
{
  "isPhoneQuery": true/false,
  "isAdversarial": true/false,
  "queries": [
    {
      "queryString": "Samsung phones under ₹30,000",
      "description": "Samsung phones within budget",
      "queryConditions": [
        {"field": "brand", "operator": "ilike", "value": "%Samsung%"},
        {"field": "price", "operator": "lte", "value": 30000}
      ]
    },
    {
      "queryString": "Best Samsung phones",
      "description": "High-rated Samsung phones",
      "queryConditions": [
        {"field": "brand", "operator": "ilike", "value": "%Samsung%"},
        {"field": "rating", "operator": "gte", "value": 4.0}
      ]
    }
  ]
}`;

    try {
      const response = await this.genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const responseText = response.text?.trim();
      if (!responseText) {
        throw new Error("No response from AI");
      }

      // Clean and parse JSON response
      let cleanedResponse = responseText;
      if (cleanedResponse.includes("```json")) {
        cleanedResponse = cleanedResponse
          .replace(/```json\s*/, "")
          .replace(/```\s*$/, "");
      } else if (cleanedResponse.includes("```")) {
        cleanedResponse = cleanedResponse
          .replace(/```\s*/, "")
          .replace(/```\s*$/, "");
      }

      cleanedResponse = cleanedResponse.trim();
      const queryInfo = JSON.parse(cleanedResponse);

      // Limit queries to maximum 3 to prevent redundancy
      const limitedQueries = (queryInfo.queries || []).slice(0, 3);

      return {
        queries: limitedQueries,
        isAdversarial: queryInfo.isAdversarial,
        isIrrelevant: !queryInfo.isPhoneQuery,
      };
    } catch (error) {
      console.error("AI Multiple Query generation failed:", error);
      throw error;
    }
  }

  private async executeMultipleSupabaseQueries(
    queries: Array<{
      queryString: string;
      description: string;
      queryConditions: Array<{
        field: string;
        operator: string;
        value: string | number | string[];
      }>;
    }>
  ): Promise<Phone[]> {
    try {
      if (!queries || queries.length === 0) {
        return [];
      }

      console.log(
        `Executing ${queries.length} queries in parallel:`,
        queries.map((q) => q.queryString)
      );

      // Execute all queries in parallel
      const queryPromises = queries.map((query) =>
        this.executeSupabaseQueryFromConditions(query.queryConditions)
      );

      const queryResults = await Promise.all(queryPromises);

      // Combine results and remove duplicates
      const allPhones: Phone[] = [];
      const seenPhones = new Set<string>();

      queryResults.forEach((phones, _index) => {
        console.log(
          ` Query ${_index + 1} (${queries[_index].queryString}): ${
            phones.length
          } phones found`
        );

        phones.forEach((phone) => {
          const phoneKey = `${phone.brand}-${phone.model}-${phone.price}`;
          if (!seenPhones.has(phoneKey)) {
            seenPhones.add(phoneKey);
            allPhones.push(phone);
          }
        });
      });

      return allPhones;
    } catch (error) {
      console.error("Error executing multiple queries:", error);
      return [];
    }
  }

  private async executeSupabaseQueryFromConditions(
    conditions: Array<{
      field: string;
      operator: string;
      value: string | number | string[];
    }>
  ): Promise<Phone[]> {
    try {
      let queryBuilder = supabase.from("phones").select("*");

      if (conditions && Array.isArray(conditions)) {
        conditions.forEach((condition) => {
          switch (condition.operator) {
            case "ilike":
              // Check if field is an array type - use different operator
              if (
                condition.field === "colours" ||
                condition.field === "camera_features" ||
                condition.field === "sensors"
              ) {
                // For array fields, use overlaps operator instead of ilike
                queryBuilder = queryBuilder.overlaps(condition.field, [
                  String(condition.value),
                ]);
              } else {
                queryBuilder = queryBuilder.ilike(
                  condition.field,
                  String(condition.value)
                );
              }
              break;
            case "eq":
              queryBuilder = queryBuilder.eq(condition.field, condition.value);
              break;
            case "lte":
              queryBuilder = queryBuilder.lte(condition.field, condition.value);
              break;
            case "gte":
              queryBuilder = queryBuilder.gte(condition.field, condition.value);
              break;
            case "not.is":
              queryBuilder = queryBuilder.not(
                condition.field,
                "is",
                condition.value
              );
              break;
            case "cs":
              queryBuilder = queryBuilder.contains(
                condition.field,
                condition.value as string[]
              );
              break;
            case "overlaps":
              queryBuilder = queryBuilder.overlaps(
                condition.field,
                condition.value as string[]
              );
              break;
            case "regex":
              // Convert regex pattern to ilike pattern for Supabase compatibility
              let ilikePattern = String(condition.value);
              ilikePattern = this.convertRegexToIlike(ilikePattern);
              queryBuilder = queryBuilder.ilike(condition.field, ilikePattern);
              break;
          }
        });
      }

      const { data, error } = await queryBuilder
        .order("rating", { ascending: false })
        .limit(10); // Sort by rating (highest first) and limit to 10 results per query
      if (error) {
        console.error("Query execution error:", error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error("Error executing query:", error);
      return [];
    }
  }

  private convertRegexToIlike(regexPattern: string): string {
    // Samsung Galaxy Series
    if (regexPattern.includes("S[0-9]+")) {
      return "%S%"; // Galaxy S series (S24, S23, etc.)
    } else if (regexPattern.includes("A[0-9]+")) {
      return "%A%"; // Galaxy A series (A54, A34, etc.)
    } else if (regexPattern.includes("M[0-9]+")) {
      return "%M%"; // Galaxy M series (M34, M14, etc.)
    } else if (regexPattern.includes("F[0-9]+")) {
      return "%F%"; // Galaxy F series (F54, F34, etc.)
    } else if (regexPattern.includes("Note")) {
      return "%Note%"; // Galaxy Note series
    } else if (regexPattern.includes("Z[0-9]+")) {
      return "%Z%"; // Galaxy Z series (foldables)
    }
    // iPhone Series
    else if (regexPattern.includes("iPhone.*Pro")) {
      return "%Pro%"; // iPhone Pro series
    } else if (regexPattern.includes("iPhone.*Plus")) {
      return "%Plus%"; // iPhone Plus series
    } else if (regexPattern.includes("iPhone.*Max")) {
      return "%Max%"; // iPhone Max series
    } else if (regexPattern.includes("iPhone.*SE")) {
      return "%SE%"; // iPhone SE series
    } else if (regexPattern.includes("iPhone.*Mini")) {
      return "%Mini%"; // iPhone Mini series
    }
    // OnePlus Series
    else if (regexPattern.includes("Nord")) {
      return "%Nord%"; // OnePlus Nord series
    } else if (regexPattern.includes("Ace")) {
      return "%Ace%"; // OnePlus Ace series
    } else if (regexPattern.includes("CE")) {
      return "%CE%"; // OnePlus CE series
    }
    // Xiaomi/Redmi Series
    else if (regexPattern.includes("Redmi.*Note")) {
      return "%Note%"; // Redmi Note series
    } else if (regexPattern.includes("Redmi.*K")) {
      return "%K%"; // Redmi K series
    } else if (regexPattern.includes("Redmi.*A")) {
      return "%A%"; // Redmi A series
    } else if (regexPattern.includes("POCO.*X")) {
      return "%X%"; // POCO X series
    } else if (regexPattern.includes("POCO.*F")) {
      return "%F%"; // POCO F series
    } else if (regexPattern.includes("POCO.*M")) {
      return "%M%"; // POCO M series
    } else if (regexPattern.includes("Mi.*Note")) {
      return "%Note%"; // Mi Note series
    } else if (regexPattern.includes("Mi.*Max")) {
      return "%Max%"; // Mi Max series
    }
    // Oppo Series
    else if (regexPattern.includes("Reno")) {
      return "%Reno%"; // Oppo Reno series
    } else if (regexPattern.includes("Find")) {
      return "%Find%"; // Oppo Find series
    } else if (regexPattern.includes("A[0-9]+")) {
      return "%A%"; // Oppo A series
    } else if (regexPattern.includes("F[0-9]+")) {
      return "%F%"; // Oppo F series
    } else if (regexPattern.includes("K[0-9]+")) {
      return "%K%"; // Oppo K series
    }
    // Vivo Series
    else if (regexPattern.includes("V[0-9]+")) {
      return "%V%"; // Vivo V series
    } else if (regexPattern.includes("X[0-9]+")) {
      return "%X%"; // Vivo X series
    } else if (regexPattern.includes("Y[0-9]+")) {
      return "%Y%"; // Vivo Y series
    } else if (regexPattern.includes("S[0-9]+")) {
      return "%S%"; // Vivo S series
    } else if (regexPattern.includes("T[0-9]+")) {
      return "%T%"; // Vivo T series
    } else if (regexPattern.includes("Z[0-9]+")) {
      return "%Z%"; // Vivo Z series
    }
    // Realme Series
    else if (regexPattern.includes("GT")) {
      return "%GT%"; // Realme GT series
    } else if (regexPattern.includes("Narzo")) {
      return "%Narzo%"; // Realme Narzo series
    } else if (regexPattern.includes("C[0-9]+")) {
      return "%C%"; // Realme C series
    } else if (regexPattern.includes("Number")) {
      return "%Number%"; // Realme Number series
    }
    // Google Pixel Series
    else if (regexPattern.includes("Pixel.*Pro")) {
      return "%Pro%"; // Pixel Pro series
    } else if (regexPattern.includes("Pixel.*a")) {
      return "%a%"; // Pixel a series
    }
    // Motorola Series
    else if (regexPattern.includes("Edge")) {
      return "%Edge%"; // Motorola Edge series
    } else if (regexPattern.includes("G[0-9]+")) {
      return "%G%"; // Motorola G series
    } else if (regexPattern.includes("E[0-9]+")) {
      return "%E%"; // Motorola E series
    }
    // Nothing Series
    else if (regexPattern.includes("Nothing.*Phone")) {
      return "%Phone%"; // Nothing Phone series
    }
    // iQOO Series
    else if (regexPattern.includes("iQOO.*Z")) {
      return "%Z%"; // iQOO Z series
    } else if (regexPattern.includes("iQOO.*Neo")) {
      return "%Neo%"; // iQOO Neo series
    } else if (regexPattern.includes("iQOO.*Pro")) {
      return "%Pro%"; // iQOO Pro series
    }
    // Infinix Series
    else if (regexPattern.includes("Infinix.*Note")) {
      return "%Note%"; // Infinix Note series
    } else if (regexPattern.includes("Infinix.*Hot")) {
      return "%Hot%"; // Infinix Hot series
    } else if (regexPattern.includes("Infinix.*Zero")) {
      return "%Zero%"; // Infinix Zero series
    }
    // Tecno Series
    else if (regexPattern.includes("Tecno.*Spark")) {
      return "%Spark%"; // Tecno Spark series
    } else if (regexPattern.includes("Tecno.*Camon")) {
      return "%Camon%"; // Tecno Camon series
    } else if (regexPattern.includes("Tecno.*Phantom")) {
      return "%Phantom%"; // Tecno Phantom series
    }
    // Lava Series
    else if (regexPattern.includes("Lava.*Agni")) {
      return "%Agni%"; // Lava Agni series
    } else if (regexPattern.includes("Lava.*Blaze")) {
      return "%Blaze%"; // Lava Blaze series
    }
    // Generic patterns
    else if (regexPattern.includes("Pro")) {
      return "%Pro%"; // Any Pro series
    } else if (regexPattern.includes("Plus")) {
      return "%Plus%"; // Any Plus series
    } else if (regexPattern.includes("Max")) {
      return "%Max%"; // Any Max series
    } else if (regexPattern.includes("Mini")) {
      return "%Mini%"; // Any Mini series
    } else if (regexPattern.includes("SE")) {
      return "%SE%"; // Any SE series
    } else if (regexPattern.includes("Ultra")) {
      return "%Ultra%"; // Any Ultra series
    } else if (regexPattern.includes("Lite")) {
      return "%Lite%"; // Any Lite series
    } else if (regexPattern.includes("Neo")) {
      return "%Neo%"; // Any Neo series
    } else {
      // Fallback: remove regex syntax and use as-is
      return regexPattern.replace(/[.*+?^${}()|[\]\\]/g, "%");
    }
  }

  // Check if query is vague based on result count
  private isQueryVague(resultCount: number): boolean {
    // If more than 50 phones are returned, consider the query vague
    // and ask follow-up questions instead of showing results
    return resultCount > 50;
  }
}

export const queryService = new QueryService();
