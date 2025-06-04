import { Platform } from 'react-native';

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

// apiUrl for different platforms
export const apiUrl = Platform.select({
    android: 'http://10.0.2.2:8000',
    ios: 'http://192.168.0.107:8000',
    default: 'http://localhost:8000', // Pour le web et d'autres plateformes
  });