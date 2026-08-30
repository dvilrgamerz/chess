import type { Puzzle } from "../../shared/types.js";

export const chessPuzzles: Puzzle[] = [
  {
    id: "puzzle-1",
    title: "Smothered Mate Threat",
    fen: "6k1/5ppp/8/8/8/8/5PPP/1R4K1 w - - 0 1",
    solutionMoves: ["Rb8#"],
    rating: 1100,
    category: "mate",
    description: "White to move. Deliver checkmate in 1 move using the back rank weakness!"
  },
  {
    id: "puzzle-2",
    title: "Royal Knight Fork",
    fen: "r1bqk2r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
    solutionMoves: ["Ng5"],
    rating: 1250,
    category: "fork",
    description: "White to move. Fork the f7 pawn and target king and rook!"
  },
  {
    id: "puzzle-3",
    title: "Queen & Bishop Battery Mate",
    fen: "r1bqkb1r/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 4",
    solutionMoves: ["Qxf7#"],
    rating: 1150,
    category: "mate",
    description: "White to move. Scholar's Mate pattern! Deliver checkmate on f7."
  },
  {
    id: "puzzle-4",
    title: "Skewer on the Rank",
    fen: "7k/8/8/8/8/8/1R6/r3K3 w - - 0 1",
    solutionMoves: ["Ke2"],
    rating: 1300,
    category: "skewer",
    description: "White to move. Escape check cleanly while protecting counter-play."
  },
  {
    id: "puzzle-5",
    title: "Pinning the Queen",
    fen: "rnb1k2r/pppp1ppp/8/4q3/4n3/2P2B2/PPP2PPP/R1BQK2R w KQkq - 0 8",
    solutionMoves: ["Re1"],
    rating: 1350,
    category: "pin",
    description: "White to move. Pin the black queen along the open e-file!"
  },
  {
    id: "puzzle-6",
    title: "Discovered Check & Queen Trap",
    fen: "r1b1k2r/ppppqppp/2n2n2/8/1b1NP3/2N1B3/PPP2PPP/R2QKB1R w KQkq - 0 7",
    solutionMoves: ["Ndb5"],
    rating: 1450,
    category: "tactic",
    description: "White to move. Create a double attack targeting c7 and the bishop."
  },
  {
    id: "puzzle-7",
    title: "Back Rank Deflection",
    fen: "3r2k1/5ppp/8/8/8/4Q3/5PPP/3R2K1 w - - 0 1",
    solutionMoves: ["Qxd8#"],
    rating: 1200,
    category: "mate",
    description: "White to move. Eliminate defender on d8 and deliver checkmate!"
  }
];

export function getRandomPuzzle(currentRating = 1200): Puzzle {
  // Find puzzle close to user's rating
  const sorted = [...chessPuzzles].sort(
    (a, b) => Math.abs(a.rating - currentRating) - Math.abs(b.rating - currentRating)
  );
  return sorted[Math.floor(Math.random() * Math.min(3, sorted.length))];
}
