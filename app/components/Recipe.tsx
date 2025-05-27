// recipe structure

export interface Recipe {
  name: string;
  ingredients: {
    name: string;
    percentage: number;
  }[];
  created_at: string;
  emoji:string
}