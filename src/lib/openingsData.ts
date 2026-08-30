export interface OpeningDef {
  name: string;
  eco: string;
  moves: string[];
  whiteWins: number;
  draws: number;
  blackWins: number;
  description: string;
  keyConcepts: string[];
}

export const openingsList: OpeningDef[] = [
  {
    name: "Ruy Lopez (Spanish Game)",
    eco: "C60",
    moves: ["e4", "e5", "Nf3", "Nc6", "Bb5"],
    whiteWins: 42,
    draws: 34,
    blackWins: 24,
    description: "One of the oldest and most classical openings. White pressure on c6 Knight puts long-term tension on Black's pawn center.",
    keyConcepts: ["Control e4 center", "Pressure c6 defender", "Kingside castling", "c3 + d4 pawn push"]
  },
  {
    name: "Sicilian Defense",
    eco: "B20",
    moves: ["e4", "c5"],
    whiteWins: 38,
    draws: 28,
    blackWins: 34,
    description: "The most popular counter-attacking response to 1.e4. Black creates asymmetrical pawn structure aiming for queenside counter-play.",
    keyConcepts: ["Asymmetrical attack", "Open c-file for rook", "d5 break opportunity", "Sharp tactical fights"]
  },
  {
    name: "Italian Game (Giuoco Piano)",
    eco: "C50",
    moves: ["e4", "e5", "Nf3", "Nc6", "Bc4"],
    whiteWins: 40,
    draws: 32,
    blackWins: 28,
    description: "Focuses on rapid development targeting Black's vulnerable f7 pawn square.",
    keyConcepts: ["Target f7 square", "Fast kingside castling", "c3 and d3 slow buildup"]
  },
  {
    name: "Queen's Gambit Accepted / Declined",
    eco: "D06",
    moves: ["d4", "d5", "c4"],
    whiteWins: 44,
    draws: 33,
    blackWins: 23,
    description: "White offers a wing pawn on c4 to gain dominant control over the center with d4 and e4.",
    keyConcepts: ["Dominant center", "c4 pawn leverage", "Queenside space gain"]
  },
  {
    name: "French Defense",
    eco: "C00",
    moves: ["e4", "e6", "d4", "d5"],
    whiteWins: 39,
    draws: 31,
    blackWins: 30,
    description: "Solid, resilient defense where Black immediately challenges e4 with d5 while maintaining a strong pawn chain.",
    keyConcepts: ["Pawn chain c6-d5-e6", "Queenside c5 break", "Light-squared bishop development solution"]
  },
  {
    name: "King's Indian Defense",
    eco: "E60",
    moves: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7"],
    whiteWins: 41,
    draws: 27,
    blackWins: 32,
    description: "Hypermodern defense where Black allows White full center control, then launches a fierce kingside attack with f5.",
    keyConcepts: ["Fianchetto Bg7", "Kingside pawn storm (f5-f4)", "Dynamic counter-attack"]
  }
];
