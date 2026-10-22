const fs = require('fs');
const exams = JSON.parse(fs.readFileSync('data/raw_exams.json', 'utf8'));

for (let e of exams) {
  console.log(`=== Exam ${e.code} (${e.date}) ===`);
  for (let i = 0; i < 3; i++) {
    const q = e.questions[i];
    console.log(`Q${q.num}. ${q.question}`);
    console.log(`   Options: ${q.options.join(' / ')}`);
    console.log(`   Answer: ${q.answer} - ${q.options[q.answerNum - 1]}`);
    if (q.image) console.log(`   Image: ${q.image}`);
  }
}
