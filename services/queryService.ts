import { supabase } from "../lib/supabase";
import { Phone } from "../types";
import { GoogleGenAI } from "@google/genai";

export interface QueryResult {
  phones: Phone[];
  query: string;
  queryDescription: string;
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
  async generateAndExecuteQuery(userQuery: string): Promise<QueryResult> {
    try {
      console.log("AI Agent received user query:", userQuery);
      console.log("Generating AI-powered Supabase query...");

      // Use AI to generate the database query
      const queryInfo = await this.generateAIQuery(userQuery);

      console.log("AI Generated Query:", queryInfo.queryString);
      console.log("Query Description:", queryInfo.description);

      // Execute the query
      const phones = await this.executeSupabaseQuery(queryInfo);

      return {
        phones,
        query: queryInfo.queryString,
        queryDescription: queryInfo.description,
      };
    } catch (error) {
      console.error("AI Query generation/execution error:", error);
      // Return empty result if AI fails
      return {
        phones: [],
        query: "Error generating query",
        queryDescription: "Failed to generate query",
      };
    }
  }

  private async generateAIQuery(userQuery: string): Promise<{
    queryString: string;
    description: string;
    queryBuilder: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }> {
    const prompt = `
      You are a database query expert for a mobile phone database. Generate a Supabase query based on the user's request.

      Database schema:
      - Table: phones
      - Columns: id, brand, model, price, release_year, os, ram, storage, display_type, display_size, resolution, refresh_rate, camera_main, camera_front, camera_features, battery, charging, processor, connectivity, sensors, features, weight, dimensions, rating, stock_status, category, colours

      IMPORTANT SEARCH RULES:
      - BRAND COLUMN: Use for company names (Samsung, Apple, OnePlus, Xiaomi, Realme, Oppo, Vivo, Google)
      - MODEL COLUMN: Use for specific phone models and series (Galaxy S24, iPhone 15, Redmi Note 12, etc.)
      - SERIES DETECTION: Use regex patterns for series (S series = S + number, A series = A + number, etc.)
      - REGEX OPERATORS: Use "regex" operator for pattern matching (e.g., "S[0-9]+" for S series)

      User Query: "${userQuery}"

      Generate a JSON response with:
      1. queryString: Human-readable description of the query
      2. description: Brief description of what the query does
      3. queryConditions: Array of Supabase query conditions

      Examples:
      - "Samsung phones" → {"queryString": "Samsung phones", "description": "All Samsung phones", "queryConditions": [{"field": "brand", "operator": "ilike", "value": "%Samsung%"}]}
      - "Samsung S series" → {"queryString": "Samsung Galaxy S series phones", "description": "Samsung Galaxy S series phones", "queryConditions": [{"field": "brand", "operator": "ilike", "value": "%Samsung%"}, {"field": "model", "operator": "regex", "value": ".*S[0-9]+.*"}]}
      - "Galaxy A series" → {"queryString": "Samsung Galaxy A series phones", "description": "Samsung Galaxy A series phones", "queryConditions": [{"field": "brand", "operator": "ilike", "value": "%Samsung%"}, {"field": "model", "operator": "regex", "value": ".*A[0-9]+.*"}]}
      - "iPhone S series" → {"queryString": "Apple iPhone S series phones", "description": "Apple iPhone S series phones", "queryConditions": [{"field": "brand", "operator": "ilike", "value": "%Apple%"}, {"field": "model", "operator": "regex", "value": ".*S[0-9]+.*"}]}
      - "Redmi Note series" → {"queryString": "Xiaomi Redmi Note series phones", "description": "Xiaomi Redmi Note series phones", "queryConditions": [{"field": "brand", "operator": "ilike", "value": "%Xiaomi%"}, {"field": "model", "operator": "regex", "value": ".*Note.*[0-9]+.*"}]}
      - "OnePlus Nord series" → {"queryString": "OnePlus Nord series phones", "description": "OnePlus Nord series phones", "queryConditions": [{"field": "brand", "operator": "ilike", "value": "%OnePlus%"}, {"field": "model", "operator": "regex", "value": ".*Nord.*"}]}
      - "Realme GT series" → {"queryString": "Realme GT series phones", "description": "Realme GT series phones", "queryConditions": [{"field": "brand", "operator": "ilike", "value": "%Realme%"}, {"field": "model", "operator": "regex", "value": ".*GT.*"}]}
      - "Show me Samsung phones only, under ₹25k" → {"queryString": "Samsung phones under ₹25,000", "description": "Samsung phones within budget", "queryConditions": [{"field": "brand", "operator": "ilike", "value": "%Samsung%"}, {"field": "price", "operator": "lte", "value": 25000}]}
      - "Galaxy A series under 30k" → {"queryString": "Samsung Galaxy A series under ₹30,000", "description": "Galaxy A series budget phones", "queryConditions": [{"field": "brand", "operator": "ilike", "value": "%Samsung%"}, {"field": "model", "operator": "regex", "value": ".*A[0-9]+.*"}, {"field": "price", "operator": "lte", "value": 30000}]}
      - "Apple phones only" → {"queryString": "Apple iPhone phones", "description": "All Apple iPhone models", "queryConditions": [{"field": "brand", "operator": "ilike", "value": "%Apple%"}]}
      - "OnePlus phones under 40k" → {"queryString": "OnePlus phones under ₹40,000", "description": "OnePlus phones within budget", "queryConditions": [{"field": "brand", "operator": "ilike", "value": "%OnePlus%"}, {"field": "price", "operator": "lte", "value": 40000}]}
      - "phones under 30000" → {"queryString": "Phones under ₹30,000", "description": "Budget phones under ₹30,000", "queryConditions": [{"field": "price", "operator": "lte", "value": 30000}]}
      - "best camera phones" → {"queryString": "High-end camera phones", "description": "Phones with excellent camera specifications", "queryConditions": [{"field": "camera_main", "operator": "not.is", "value": null}]}
      - "black phones" → {"queryString": "Black colored phones", "description": "Phones available in black color", "queryConditions": [{"field": "colours", "operator": "cs", "value": "[\"Black\"]"}]}
      - "phones in blue or white" → {"queryString": "Blue or white colored phones", "description": "Phones available in blue or white colors", "queryConditions": [{"field": "colours", "operator": "overlaps", "value": "[\"Blue\", \"White\"]"}]}

      Respond with ONLY the JSON object, no other text.`;

    try {
      const response = await this.genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const responseText = response.text?.trim();
      if (!responseText) {
        throw new Error("No response from AI");
      }

      // Clean and parse JSON response - handle markdown formatting
      let cleanedResponse = responseText;

      // Remove markdown code blocks if present
      if (cleanedResponse.includes("```json")) {
        cleanedResponse = cleanedResponse
          .replace(/```json\s*/, "")
          .replace(/```\s*$/, "");
      } else if (cleanedResponse.includes("```")) {
        cleanedResponse = cleanedResponse
          .replace(/```\s*/, "")
          .replace(/```\s*$/, "");
      }

      // Remove any leading/trailing whitespace
      cleanedResponse = cleanedResponse.trim();

      // Parse JSON response
      const queryInfo = JSON.parse(cleanedResponse);

      // Build Supabase query from conditions
      let queryBuilder: any = supabase.from("phones").select("*"); // eslint-disable-line @typescript-eslint/no-explicit-any

      if (
        queryInfo.queryConditions &&
        Array.isArray(queryInfo.queryConditions)
      ) {
        queryInfo.queryConditions.forEach((condition: any) => {
          // eslint-disable-line @typescript-eslint/no-explicit-any
          switch (condition.operator) {
            case "ilike":
              queryBuilder = queryBuilder.ilike(
                condition.field,
                condition.value
              );
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
              queryBuilder = queryBuilder.cs(condition.field, condition.value);
              break;
            case "overlaps":
              queryBuilder = queryBuilder.overlaps(
                condition.field,
                condition.value
              );
              break;
            case "regex":
              // Convert regex pattern to ilike pattern for Supabase compatibility
              let ilikePattern = condition.value;

              // Samsung Galaxy Series
              if (condition.value.includes("S[0-9]+")) {
                ilikePattern = "%S%"; // Galaxy S series (S24, S23, etc.)
              } else if (condition.value.includes("A[0-9]+")) {
                ilikePattern = "%A%"; // Galaxy A series (A54, A34, etc.)
              } else if (condition.value.includes("M[0-9]+")) {
                ilikePattern = "%M%"; // Galaxy M series (M34, M14, etc.)
              } else if (condition.value.includes("F[0-9]+")) {
                ilikePattern = "%F%"; // Galaxy F series (F54, F34, etc.)
              } else if (condition.value.includes("Note")) {
                ilikePattern = "%Note%"; // Galaxy Note series
              } else if (condition.value.includes("Z[0-9]+")) {
                ilikePattern = "%Z%"; // Galaxy Z series (foldables)

                // iPhone Series
              } else if (condition.value.includes("iPhone.*Pro")) {
                ilikePattern = "%Pro%"; // iPhone Pro series
              } else if (condition.value.includes("iPhone.*Plus")) {
                ilikePattern = "%Plus%"; // iPhone Plus series
              } else if (condition.value.includes("iPhone.*Max")) {
                ilikePattern = "%Max%"; // iPhone Max series
              } else if (condition.value.includes("iPhone.*SE")) {
                ilikePattern = "%SE%"; // iPhone SE series
              } else if (condition.value.includes("iPhone.*Mini")) {
                ilikePattern = "%Mini%"; // iPhone Mini series

                // OnePlus Series
              } else if (condition.value.includes("Nord")) {
                ilikePattern = "%Nord%"; // OnePlus Nord series
              } else if (condition.value.includes("Ace")) {
                ilikePattern = "%Ace%"; // OnePlus Ace series
              } else if (condition.value.includes("CE")) {
                ilikePattern = "%CE%"; // OnePlus CE series

                // Xiaomi/Redmi Series
              } else if (condition.value.includes("Redmi.*Note")) {
                ilikePattern = "%Note%"; // Redmi Note series
              } else if (condition.value.includes("Redmi.*K")) {
                ilikePattern = "%K%"; // Redmi K series
              } else if (condition.value.includes("Redmi.*A")) {
                ilikePattern = "%A%"; // Redmi A series
              } else if (condition.value.includes("POCO.*X")) {
                ilikePattern = "%X%"; // POCO X series
              } else if (condition.value.includes("POCO.*F")) {
                ilikePattern = "%F%"; // POCO F series
              } else if (condition.value.includes("POCO.*M")) {
                ilikePattern = "%M%"; // POCO M series
              } else if (condition.value.includes("Mi.*Note")) {
                ilikePattern = "%Note%"; // Mi Note series
              } else if (condition.value.includes("Mi.*Max")) {
                ilikePattern = "%Max%"; // Mi Max series

                // Oppo Series
              } else if (condition.value.includes("Reno")) {
                ilikePattern = "%Reno%"; // Oppo Reno series
              } else if (condition.value.includes("Find")) {
                ilikePattern = "%Find%"; // Oppo Find series
              } else if (condition.value.includes("A[0-9]+")) {
                ilikePattern = "%A%"; // Oppo A series
              } else if (condition.value.includes("F[0-9]+")) {
                ilikePattern = "%F%"; // Oppo F series
              } else if (condition.value.includes("K[0-9]+")) {
                ilikePattern = "%K%"; // Oppo K series

                // Vivo Series
              } else if (condition.value.includes("V[0-9]+")) {
                ilikePattern = "%V%"; // Vivo V series
              } else if (condition.value.includes("X[0-9]+")) {
                ilikePattern = "%X%"; // Vivo X series
              } else if (condition.value.includes("Y[0-9]+")) {
                ilikePattern = "%Y%"; // Vivo Y series
              } else if (condition.value.includes("S[0-9]+")) {
                ilikePattern = "%S%"; // Vivo S series
              } else if (condition.value.includes("T[0-9]+")) {
                ilikePattern = "%T%"; // Vivo T series
              } else if (condition.value.includes("Z[0-9]+")) {
                ilikePattern = "%Z%"; // Vivo Z series

                // Realme Series
              } else if (condition.value.includes("GT")) {
                ilikePattern = "%GT%"; // Realme GT series
              } else if (condition.value.includes("Narzo")) {
                ilikePattern = "%Narzo%"; // Realme Narzo series
              } else if (condition.value.includes("C[0-9]+")) {
                ilikePattern = "%C%"; // Realme C series
              } else if (condition.value.includes("Number")) {
                ilikePattern = "%Number%"; // Realme Number series

                // Google Pixel Series
              } else if (condition.value.includes("Pixel.*Pro")) {
                ilikePattern = "%Pro%"; // Pixel Pro series
              } else if (condition.value.includes("Pixel.*a")) {
                ilikePattern = "%a%"; // Pixel a series

                // Motorola Series
              } else if (condition.value.includes("Edge")) {
                ilikePattern = "%Edge%"; // Motorola Edge series
              } else if (condition.value.includes("G[0-9]+")) {
                ilikePattern = "%G%"; // Motorola G series
              } else if (condition.value.includes("E[0-9]+")) {
                ilikePattern = "%E%"; // Motorola E series

                // Nothing Series
              } else if (condition.value.includes("Nothing.*Phone")) {
                ilikePattern = "%Phone%"; // Nothing Phone series

                // iQOO Series
              } else if (condition.value.includes("iQOO.*Z")) {
                ilikePattern = "%Z%"; // iQOO Z series
              } else if (condition.value.includes("iQOO.*Neo")) {
                ilikePattern = "%Neo%"; // iQOO Neo series
              } else if (condition.value.includes("iQOO.*Pro")) {
                ilikePattern = "%Pro%"; // iQOO Pro series

                // Infinix Series
              } else if (condition.value.includes("Infinix.*Note")) {
                ilikePattern = "%Note%"; // Infinix Note series
              } else if (condition.value.includes("Infinix.*Hot")) {
                ilikePattern = "%Hot%"; // Infinix Hot series
              } else if (condition.value.includes("Infinix.*Zero")) {
                ilikePattern = "%Zero%"; // Infinix Zero series

                // Tecno Series
              } else if (condition.value.includes("Tecno.*Spark")) {
                ilikePattern = "%Spark%"; // Tecno Spark series
              } else if (condition.value.includes("Tecno.*Camon")) {
                ilikePattern = "%Camon%"; // Tecno Camon series
              } else if (condition.value.includes("Tecno.*Phantom")) {
                ilikePattern = "%Phantom%"; // Tecno Phantom series

                // Lava Series
              } else if (condition.value.includes("Lava.*Agni")) {
                ilikePattern = "%Agni%"; // Lava Agni series
              } else if (condition.value.includes("Lava.*Blaze")) {
                ilikePattern = "%Blaze%"; // Lava Blaze series

                // Generic patterns
              } else if (condition.value.includes("Pro")) {
                ilikePattern = "%Pro%"; // Any Pro series
              } else if (condition.value.includes("Plus")) {
                ilikePattern = "%Plus%"; // Any Plus series
              } else if (condition.value.includes("Max")) {
                ilikePattern = "%Max%"; // Any Max series
              } else if (condition.value.includes("Mini")) {
                ilikePattern = "%Mini%"; // Any Mini series
              } else if (condition.value.includes("SE")) {
                ilikePattern = "%SE%"; // Any SE series
              } else if (condition.value.includes("Ultra")) {
                ilikePattern = "%Ultra%"; // Any Ultra series
              } else if (condition.value.includes("Lite")) {
                ilikePattern = "%Lite%"; // Any Lite series
              } else if (condition.value.includes("Neo")) {
                ilikePattern = "%Neo%"; // Any Neo series
              } else {
                // Fallback: remove regex syntax and use as-is
                ilikePattern = condition.value.replace(
                  /[.*+?^${}()|[\]\\]/g,
                  "%"
                );
              }
              queryBuilder = queryBuilder.ilike(condition.field, ilikePattern);
              break;
          }
        });
      }

      return {
        queryString: queryInfo.queryString || "AI Generated Query",
        description: queryInfo.description || "AI Generated Description",
        queryBuilder,
      };
    } catch (error) {
      console.error("AI Query generation failed:", error);
      throw error;
    }
  }

  private async executeSupabaseQuery(queryInfo: {
    queryBuilder: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    description: string;
  }): Promise<Phone[]> {
    try {
      console.log("AI Agent executing Supabase query:");
      console.log("Query Description:", queryInfo.description);
      console.log("Query Builder:", queryInfo.queryBuilder);
      console.log("Execution Time:", new Date().toISOString());

      const { data, error } = await queryInfo.queryBuilder;

      if (error) {
        console.error(" Supabase query error:", error);
        console.log(" Failed Query Details:", {
          description: queryInfo.description,
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        return [];
      }

      console.log("Query executed successfully!");
      console.log("Results found:", data?.length || 0, "phones");

      // If no results found, let's check what's available in the database
      if (!data || data.length === 0) {
        console.log("No results found. Checking database contents...");
        await this.debugDatabaseContents(queryInfo.description);
      }

      console.log("Query completed at:", new Date().toISOString());
      console.log("========================================");

      return data || [];
    } catch (error) {
      console.error("Query execution error:", error);
      console.log("Error Details:", {
        description: queryInfo.description,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      console.log("========================================");
      return [];
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async debugDatabaseContents(
    _queryDescription: string
  ): Promise<void> {
    try {
      // Check total phones count
      const { count: totalCount } = await supabase
        .from("phones")
        .select("*", { count: "exact", head: true });

      console.log(`Total phones in database: ${totalCount}`);

      // Check Samsung phones specifically
      const { data: samsungPhones } = await supabase
        .from("phones")
        .select("brand, model, price")
        .ilike("brand", "%Samsung%")
        .order("price", { ascending: true });

      console.log(`Samsung phones found: ${samsungPhones?.length || 0}`);
      if (samsungPhones && samsungPhones.length > 0) {
        console.log("Samsung phones:", samsungPhones.slice(0, 5));
      }

      // Check phones under 25k
      const { data: phonesUnder25k } = await supabase
        .from("phones")
        .select("brand, model, price")
        .lt("price", 25000)
        .order("price", { ascending: true });

      console.log(`Phones under ₹25k: ${phonesUnder25k?.length || 0}`);
      if (phonesUnder25k && phonesUnder25k.length > 0) {
        console.log("Phones under ₹25k:", phonesUnder25k.slice(0, 5));
      }

      // Check all brands
      const { data: allBrands } = await supabase
        .from("phones")
        .select("brand")
        .order("brand");

      if (allBrands) {
        const uniqueBrands = [...new Set(allBrands.map((p) => p.brand))];
        console.log("Available brands:", uniqueBrands);
      }
    } catch (error) {
      console.error("Debug query failed:", error);
    }
  }

  // Method to get database schema for AI context
  getDatabaseSchema(): string {
    return `
    Database Schema: phones table

    Table: phones
    Columns:
    - id: number (primary key)
    - brand: string (e.g., "Samsung", "Apple", "OnePlus")
    - model: string (e.g., "Galaxy S24", "iPhone 15")
    - price: number (in INR)
    - release_year: number (e.g., 2024)
    - os: string (e.g., "Android", "iOS")
    - ram: string (e.g., "8GB", "12GB")
    - storage: string (e.g., "128GB", "256GB")
    - display_type: string (e.g., "AMOLED", "LCD")
    - display_size: string (e.g., "6.1 inches")
    - resolution: string (e.g., "1080x2400")
    - refresh_rate: number (e.g., 120)
    - camera_main: string (e.g., "50MP")
    - camera_front: string (e.g., "12MP")
    - camera_features: string[] (e.g., ["OIS", "Night Mode"])
    - battery: string (e.g., "4000mAh")
    - charging: string (e.g., "65W Fast Charging")
    - processor: string (e.g., "Snapdragon 8 Gen 3")
    - connectivity: string[] (e.g., ["5G", "WiFi 6"])
    - sensors: string[] (e.g., ["Fingerprint", "Face ID"])
    - features: string[] (e.g., ["Wireless Charging", "Water Resistant"])
    - weight: string (e.g., "180g")
    - dimensions: string (e.g., "150x70x8mm")
    - rating: number (1-5)
    - stock_status: string (e.g., "In Stock", "Out of Stock")
    - category: string (e.g., "Flagship", "Mid-range", "Budget")
    - colours: string[] (e.g., ["Black", "White", "Blue"])
    `;
  }
}

export const queryService = new QueryService();
