"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// We define the types based on our Supabase table
type QuestionOption = {
  label: string;
  value: string;
};

type Question = {
  id: string;
  text: string;
  type: 'single-choice' | 'text-input';
  field_to_set: string;
  options: QuestionOption[] | null;
  next_question_id: string | null;
};

export default function TreeWizardPage() {
  const supabase = createClient();
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [textInputValue, setTextInputValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch a question by its ID
  const fetchQuestion = async (id: string) => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      setError("Could not fetch question. " + error.message);
    } else {
      setCurrentQuestion(data);
    }
    setLoading(false);
  };

  // On component mount, fetch the starting question
  useEffect(() => {
    const fetchStartNode = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("questions")
        .select("*")
        .eq("is_start_node", true)
        .single();

      if (error) {
        setError("Could not find a starting question. " + error.message);
      } else {
        setCurrentQuestion(data);
      }
      setLoading(false);
    };

    fetchStartNode();
  }, [supabase]);

  const handleAnswer = (value: string) => {
    if (!currentQuestion) return;

    // Store the answer
    const newAnswers = { ...answers, [currentQuestion.field_to_set]: value };
    setAnswers(newAnswers);

    // Logic to find the next question (this is a simplified example)
    // For 'single-choice', you might have a mapping. For 'text-input', it's direct.
    if (currentQuestion.next_question_id) {
      fetchQuestion(currentQuestion.next_question_id);
    } else {
      // This is the end of the wizard path
      setCurrentQuestion(null);
      console.log("Wizard finished! Final answers:", newAnswers);
      // Here you would trigger the API call to generate the final prompt
    }
  };

  return (
    <main className="home-container">
      <div className="home-content">
        <h1>Question-Based Prompt Builder</h1>

        {loading && <p>Loading question...</p>}
        {error && <p style={{ color: 'red' }}>{error}</p>}

        {currentQuestion && (
          <div>
            <h2>{currentQuestion.text}</h2>
            {/* Render logic for different question types will go here */}
          </div>
        )}

        {!loading && !currentQuestion && Object.keys(answers).length > 0 && (
          <div>
            <h2>Wizard Complete!</h2>
            <pre>{JSON.stringify(answers, null, 2)}</pre>
          </div>
        )}
      </div>
    </main>
  );
}
