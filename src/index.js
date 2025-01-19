const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let games = {}; // Store game data

// Serve static files
app.use(express.static("public"));

io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Handle join_game event
    socket.on("join_game", ({ gameCode, playerName, role }) => {
        if (!games[gameCode]) {
            games[gameCode] = {
                players: {},
                master: null,
                question: null,
                answers: {},
                tokens: {},
            };
        }

        if (role === "master") {
            games[gameCode].master = socket.id; // Assign master role
        } else {
            games[gameCode].players[socket.id] = playerName;
            games[gameCode].tokens[socket.id] = 0;
        }

        socket.join(gameCode);

        // Emit role to the user
        socket.emit("role_assigned", { role });

        // Emit updated player list to the master
        if (games[gameCode].master) {
            io.to(games[gameCode].master).emit(
                "update_players",
                games[gameCode].players,
            );
        }
    });

    // Handle start_question event
    socket.on("start_question", ({ gameCode, question }) => {
        const game = games[gameCode];
        if (game && socket.id === game.master) {
            // Reset answers and most common answer
            game.question = question;
            game.answers = {}; // Clear answers from the previous round

            // Notify all clients about the new question
            io.to(gameCode).emit("new_question", {
                question,
                mostCommonAnswer: null, // Clear the most common answer
            });
        }
    });

    // Handle submit_answer event
    socket.on("submit_answer", ({ gameCode, answer }) => {
        const game = games[gameCode];
        // Validate game existence
        if (!game) {
            console.error(`Game not found for code: ${gameCode}`);
            return;
        }

        // Ensure game.answers exists
        if (!game.answers) {
            game.answers = {};
        }

        game.answers[socket.id] = answer;

        const playerCount = Object.keys(game.players).length;
        const answerCount = Object.keys(game.answers).length;

        // Check if all players and master have submitted answers
        if (playerCount + 1 === answerCount) {
            const answers = Object.values(game.answers);
            const answerFrequency = {};

            // Count the frequency of each answer
            answers.forEach((ans) => {
                answerFrequency[ans] = (answerFrequency[ans] || 0) + 1;
            });

            const maxCount = Math.max(...Object.values(answerFrequency));
            const mostCommonAnswer = Object.keys(answerFrequency).find(
                (key) => answerFrequency[key] === maxCount,
            );

            // Determine who gets tokens
            for (const [playerId, ans] of Object.entries(game.answers)) {
                if (ans === mostCommonAnswer) {
                    game.tokens[playerId]++;
                }
            }

            // Determine if a Purple Cow exists
            const uniqueAnswers = Object.entries(answerFrequency).filter(
                ([_, count]) => count === 1,
            );

            let purpleCowPlayer = null;

            if (uniqueAnswers.length === 1) {
                // Only one unique answer, assign Purple Cow
                const uniqueAnswer = uniqueAnswers[0][0];
                purpleCowPlayer = Object.keys(game.answers).find(
                    (playerId) => game.answers[playerId] === uniqueAnswer,
                );
            }

            // Emit results
            io.to(gameCode).emit("show_results", {
                tokens: game.tokens,
                mostCommonAnswer,
                answers: game.answers,
                purpleCowPlayer, // Send the Purple Cow player ID (or null)
            });
        }
    });

    socket.on("play_again", ({ gameCode }) => {
        const game = games[gameCode];
        if (!game) {
            console.error(`Game not found for code: ${gameCode}`);
            return;
        }

        // Reset game state for the next question
        game.question = null;
        game.answers = {};

        // Notify all clients to reset for the next round
        io.to(gameCode).emit("reset_for_next_question", {
            tokens: game.tokens,
        });
    });

    socket.on("join_game", ({ gameCode, playerName, role }) => {
        if (!games[gameCode]) {
            games[gameCode] = {
                players: {},
                master: null,
                question: null,
                answers: {},
                tokens: {},
            };
        }

        if (role === "master") {
            games[gameCode].master = socket.id; // Assign the master role
            games[gameCode].tokens[socket.id] = 0; // Allow master to earn tokens
        } else {
            games[gameCode].players[socket.id] = playerName;
            games[gameCode].tokens[socket.id] = 0;
        }

        socket.join(gameCode);

        // Emit role to the user
        socket.emit("role_assigned", { role });

        // Emit updated player list to the master
        if (games[gameCode].master) {
            io.to(games[gameCode].master).emit(
                "update_players",
                games[gameCode].players,
            );
        }
    });

    // Handle disconnect event
    socket.on("disconnect", () => {
        for (const [gameCode, game] of Object.entries(games)) {
            if (game.players[socket.id]) {
                delete game.players[socket.id];
                delete game.tokens[socket.id];

                if (Object.keys(game.players).length === 0 && !game.master) {
                    delete games[gameCode];
                } else {
                    // Emit updated players list to the master
                    if (game.master) {
                        io.to(game.master).emit("update_players", game.players);
                    }
                }
                break;
            } else if (game.master === socket.id) {
                // Remove the master and delete the game
                delete games[gameCode];
                io.to(gameCode).emit(
                    "game_ended",
                    "The master has disconnected.",
                );
                break;
            }
        }
        console.log("A user disconnected:", socket.id);
    });

    /*    
    socket.on("start_question", ({ gameCode, question }) => {
        console.log(
            `Received start_question: gameCode=${gameCode}, question=${question}`,
        );
        const game = games[gameCode];

        if (!game) {
            console.error(`Game not found for code: ${gameCode}`);
            return;
        }

        console.log(`Current game state:`, game);
    });
    */

    socket.on("submit_answer", ({ gameCode, answer }) => {
        console.log(
            `Received submit_answer: gameCode=${gameCode}, answer=${answer} from${socket.id}`,
        );
        const game = games[gameCode];

        if (!game) {
            console.error(`Game not found for code: ${gameCode}`);
            return;
        }

        console.log(`Current game state:`, game);
    });
});

server.listen(3000, () => {
    console.log("Server is running on port 3000");
});



