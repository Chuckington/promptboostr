"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// We define the types based on our Supabase table
type QuestionOption = {
  label: string;
  value: string;
  next_question_id?: string | null; // The next question can be tied to the option
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

  // On component mount, fetch the starting question.
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

  const handleAnswer = (value: string, nextQuestionId?: string | null) => {
    if (!currentQuestion) return;

    // Store the answer
    const newAnswers = { ...answers, [currentQuestion.field_to_set]: value };
    setAnswers(newAnswers);
    setTextInputValue(""); // Reset text input after submission

    // Determine the next question ID.
    // For single-choice, it comes from the option. For text-input, from the question.
    const nextId = nextQuestionId || currentQuestion.next_question_id;

    if (nextId) {
      fetchQuestion(nextId);
    } else {
      // This is the end of the wizard path
      setCurrentQuestion(null);
      console.log("Wizard finished! Final answers:", newAnswers);
      // Here you would trigger the API call to generate the final prompt
    }
  };

  const renderQuestion = () => {
    if (!currentQuestion) return null;

    switch (currentQuestion.type) {
      case 'single-choice':
        return currentQuestion.options?.map((option) => (
          <button key={option.value} onClick={() => handleAnswer(option.value, option.next_question_id)} className="wizard-button">
            {option.label}
          </button>
        ));
      case 'text-input':
        return (
          <form onSubmit={(e) => { e.preventDefault(); handleAnswer(textInputValue); }} className="wizard-form">
            <input
              type="text"
              value={textInputValue}
              onChange={(e) => setTextInputValue(e.target.value)}
              className="wizard-input"
              placeholder="Type your answer here..."
              autoFocus
            />
            <button type="submit" className="wizard-button">Next</button>
          </form>
        );
      default:
        return <p>Unknown question type.</p>;
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
            <h2 style={{ marginBottom: '1.5rem' }}>{currentQuestion.text}</h2>
            <div className="wizard-form-actions" style={{ flexDirection: 'column' }}>{renderQuestion()}</div>
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
