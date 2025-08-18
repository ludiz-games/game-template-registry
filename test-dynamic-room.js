// Simple test script to verify the dynamic room works
import { Client } from "colyseus.js";

const client = new Client("ws://localhost:2567");

async function testDynamicRoom() {
  console.log("🚀 Testing Dynamic Room Implementation");
  console.log("=====================================");

  try {
    // Join the dynamic room
    console.log("1. Joining dynamic room...");
    const room = await client.joinOrCreate("project", {
      projectId: "dev",
      blueprintId: "multi-quiz",
      version: "latest",
      name: "TestPlayer",
    });

    console.log(`✅ Successfully joined room: ${room.id}`);

    // Listen for state changes
    room.onStateChange((state) => {
      console.log(`📊 State Update:`, {
        phase: state.phase,
        stepIndex: state.stepIndex,
        timeLeftSec: state.timeLeftSec,
        playersCount: state.players ? state.players.size : 0,
        currentQuestion: state.current?.question || null,
        currentKind: state.current?.kind || null,
      });
    });

    // Wait a moment for initial state
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Start the game
    console.log("2. Starting game...");
    room.send("game.start");

    // Wait for game to start
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Submit some answers
    console.log("3. Submitting answers...");

    // Answer 1 - MCQ (correct answer is index 1)
    room.send("answer.submit", { choiceIndex: 1 });
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Answer 2 - True/False (correct answer is true)
    room.send("answer.submit", { value: true });
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Answer 3 - MCQ (correct answer is index 2)
    room.send("answer.submit", { choiceIndex: 2 });
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log("4. Test completed!");

    // Leave room
    room.leave();
    console.log("✅ Successfully left room");
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

testDynamicRoom();
