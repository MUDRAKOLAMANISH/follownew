import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import ProblemSolution from '../components/ProblemSolution';
import DemoFeatures from '../components/DemoFeatures';
import JourneyUseCases from '../components/JourneyUseCases';
import SocialProof from '../components/SocialProof';
import Footer from '../components/Footer';
import FollowBuddyChat from '../components/FollowBuddyChat';

export default function Landing() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <ProblemSolution />
        <DemoFeatures />
        <JourneyUseCases />
        <SocialProof />
      </main>
      <Footer />
      {/* Front-Page AI Chatbot: Follow Buddy */}
      <FollowBuddyChat />
    </>
  );
}
