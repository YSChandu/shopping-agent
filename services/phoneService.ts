import { supabase } from "../lib/supabase";
import { Phone, SearchFilters } from "../types";

class PhoneService {
  async getAllPhones(): Promise<Phone[]> {
    try {
      const { data, error } = await supabase
        .from("phones")
        .select("*")
        .order("price", { ascending: true });

      if (error) {
        throw new Error(`Error fetching phones: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error("Phone Service Error:", error);
      throw error;
    }
  }

  async searchPhones(filters: SearchFilters): Promise<Phone[]> {
    try {
      let query = supabase.from("phones").select("*");

      if (filters.maxPrice) {
        query = query.lt("price", filters.maxPrice);
      }

      if (filters.minPrice) {
        query = query.gt("price", filters.minPrice);
      }

      if (filters.brand) {
        query = query.ilike("brand", `%${filters.brand}%`);
      }

      if (filters.os) {
        query = query.ilike("os", `%${filters.os}%`);
      }

      if (filters.ram) {
        query = query.ilike("ram", `%${filters.ram}%`);
      }

      if (filters.storage) {
        query = query.ilike("storage", `%${filters.storage}%`);
      }

      if (filters.features && filters.features.length > 0) {
        query = query.overlaps("features", filters.features);
      }

      const { data, error } = await query.order("price", { ascending: true });

      if (error) {
        throw new Error(`Error searching phones: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error("Phone Search Error:", error);
      throw error;
    }
  }

  async getPhonesUnderPrice(maxPrice: number): Promise<Phone[]> {
    try {
      const { data, error } = await supabase
        .from("phones")
        .select("*")
        .lt("price", maxPrice)
        .order("price", { ascending: true });

      if (error) {
        throw new Error(
          `Error fetching phones under ₹${maxPrice}: ${error.message}`
        );
      }

      return data || [];
    } catch (error) {
      console.error("Phone Service Error:", error);
      throw error;
    }
  }

  async getPhoneById(id: number): Promise<Phone | null> {
    try {
      const { data, error } = await supabase
        .from("phones")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        throw new Error(`Error fetching phone: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error("Phone Service Error:", error);
      return null;
    }
  }

  async getPhonesByBrand(brand: string): Promise<Phone[]> {
    try {
      const { data, error } = await supabase
        .from("phones")
        .select("*")
        .ilike("brand", `%${brand}%`)
        .order("price", { ascending: true });

      if (error) {
        throw new Error(`Error fetching phones by brand: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error("Phone Service Error:", error);
      throw error;
    }
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);
  }
}

export const phoneService = new PhoneService();
