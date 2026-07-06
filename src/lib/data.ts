import EN_SENTS_DATA from "../data/en_sents.json";
import EN_WORDS_DATA from "../data/en_words.json";
import JP_SENTS_DATA from "../data/jp_sents.json";
import JP_WORDS_DATA from "../data/jp_words.json";
import SYM_ITEMS_DATA from "../data/sym_items.json";

export const EN_WORDS: string[] = EN_WORDS_DATA;
export const EN_SENTS: string[] = EN_SENTS_DATA;
export const JP_WORDS = JP_WORDS_DATA as [kana: string, display: string][];
export const JP_SENTS = JP_SENTS_DATA as [kana: string, display: string][];
export const SYM_ITEMS: string[] = SYM_ITEMS_DATA;
