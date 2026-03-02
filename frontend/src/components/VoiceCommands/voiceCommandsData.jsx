export const VOICE_COMMAND_TYPES = ["Drill", "Parade", "Salute", "March"];

export const VOICE_COMMANDS = [
  {
    id: "savdhan",
    name: "Savdhan",
    type: "Drill",
    hindi: "सावधान",
    phonetic: "Saav-dhaan",
    hindiExplanation:
      "इस कमांड पर कैडेट अपने दोनों पैरों को मिलाकर, शरीर सीधा रखकर, छाती बाहर, ठोड़ी ऊपर और हाथ जांघों से सटे हुए पूरी सतर्क अवस्था में खड़े होते हैं। यह स्थिति पूर्ण अनुशासन और तत्परता को दर्शाती है।",
    englishExplanation:
      "On this command, cadets stand with their heels together, body straight, chest out, chin slightly raised, and arms aligned along the thighs. It represents full attention, discipline, and readiness.",
  },
  {
    id: "vishram",
    name: "Vishram",
    type: "Drill",
    hindi: "विश्राम",
    phonetic: "Vish-raam",
    hindiExplanation:
      "इस कमांड पर कैडेट सावधान स्थिति से हल्की आराम की स्थिति में आते हैं, जिसमें पैर थोड़े खुले होते हैं और हाथ पीछे की ओर बांधे जाते हैं। यह आराम की स्थिति है, लेकिन अनुशासन बनाए रखना आवश्यक होता है।",
    englishExplanation:
      "On this command, cadets move from attention to a relaxed standing position by spreading their feet slightly apart and placing hands behind their back. It is a rest position while maintaining discipline.",
  },
  {
    id: "salami_shastr",
    name: "Salami Shastr",
    type: "Salute",
    hindi: "सलामी शस्त्र",
    phonetic: "Sa-laa-mee Shas-tr",
    hindiExplanation:
      "यह कमांड औपचारिक सम्मान प्रकट करने के लिए दी जाती है। इस पर कैडेट हथियार के साथ निर्धारित ड्रिल प्रक्रिया के अनुसार सलामी की स्थिति में आते हैं। यह वरिष्ठ अधिकारी या राष्ट्रीय ध्वज के सम्मान में प्रयोग की जाती है।",
    englishExplanation:
      "This command is given to present a formal salute with arms as per drill procedure. It is used to show respect to senior officers or during ceremonial occasions such as saluting the national flag.",
  },
  {
    id: "tez_chal",
    name: "Tez Chal",
    type: "March",
    hindi: "तेज चाल",
    phonetic: "Tez Chal",
    hindiExplanation:
      "इस कमांड पर कैडेट नियमित गति से मार्च करना प्रारंभ करते हैं। सभी को समान ताल, कदम और दूरी बनाए रखते हुए समन्वय में आगे बढ़ना होता है।",
    englishExplanation:
      "This command initiates regular pace marching. Cadets begin moving forward in synchronized steps while maintaining proper alignment, rhythm, and spacing.",
  },
  {
    id: "tham",
    name: "Tham",
    type: "Parade",
    hindi: "थम",
    phonetic: "Thum",
    hindiExplanation:
      "यह कमांड मार्च करते हुए दस्ते को नियंत्रित और अनुशासित तरीके से रोकने के लिए दी जाती है। अंतिम कदम के बाद सभी कैडेट सावधान स्थिति में स्थिर हो जाते हैं।",
    englishExplanation:
      "This command is used to halt the marching squad in a controlled and disciplined manner. After the final step, all cadets immediately return to the attention position.",
  },
  {
    id: "dahine_mud",
    name: "Dahine Mud",
    type: "Parade",
    hindi: "दाहिने मुड़",
    phonetic: "Daa-hi-nay Mud",
    hindiExplanation:
      "इस कमांड पर पूरा दस्ता दाईं ओर 90 डिग्री घूमता है। सभी कैडेट एक साथ एड़ी और पंजे की सही गति से मुड़ते हैं और पंक्ति की सीध बनाए रखते हैं।",
    englishExplanation:
      "On this command, the unit turns 90 degrees to the right in one synchronized movement. Cadets pivot correctly on heel and toe while maintaining alignment and formation discipline.",
  },
];

import Modal from '../Modal';
import { useState } from 'react';
import AudioPlayer from '../AudioPlayer';

const VoiceCommands = () => {
  const [selectedCommand, setSelectedCommand] = useState(null);
  const [isModalOpen, setModalOpen] = useState(false);

  const handleDetailsClick = (command) => {
    setSelectedCommand(command);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedCommand(null);
  };

  return (
    <div>
      {VOICE_COMMANDS.map((command) => (
        <div key={command.id}>
          <h3>{command.name}</h3>
          <button onClick={() => handleDetailsClick(command)}>Details</button>
        </div>
      ))}

      <Modal isOpen={isModalOpen} onClose={closeModal}>
        {selectedCommand && (
          <div>
            <h1>{selectedCommand.name}</h1>
            <p>Type: {selectedCommand.type}</p>
            <p>Hindi: {selectedCommand.hindi}</p>
            <p>Phonetic: {selectedCommand.phonetic}</p>
            <p>{selectedCommand.hindiExplanation}</p>
            <p>{selectedCommand.englishExplanation}</p>
            <AudioPlayer src={`/audio/${selectedCommand.id}.mp3`} />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default VoiceCommands;