const fs = require('fs');
const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');

async function main() {
  const canvasMod = require('@napi-rs/canvas');
  if (!global.DOMMatrix && canvasMod.DOMMatrix) global.DOMMatrix = canvasMod.DOMMatrix;
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { PDFParse } = require('pdf-parse');

  const imgOutputDir = path.join(__dirname, 'images');
  if (!fs.existsSync(imgOutputDir)) fs.mkdirSync(imgOutputDir, { recursive: true });

  const dataOutputDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataOutputDir)) fs.mkdirSync(dataOutputDir, { recursive: true });

  // 1. Load existing explanations for 20260802
  const mdPath = path.join(__dirname, '네트워크관리사2급_기출문제_해설.md');
  const explanations20260802 = {};
  if (fs.existsSync(mdPath)) {
    const md = fs.readFileSync(mdPath, 'utf8');
    const qBlocks = md.split(/^###\s+/m);
    for (let b of qBlocks) {
      const m = b.match(/^(\d{1,2})\.\s+([^\n]+)/);
      if (m) {
        const num = parseInt(m[1], 10);
        const expM = b.match(/- \*\*초심자 해설\*\*:\s*([\s\S]*?)(?:---|$)/);
        if (expM) {
          explanations20260802[num] = expM[1].trim();
        }
      }
    }
  }

  function cleanText(t) {
    return t.replace(/\t+/g, ' ').replace(/[ ]{2,}/g, ' ').trim();
  }

  function parseAnswers(text) {
    const answers = {};
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].replace(/\s+/g, ' ');
      if (/^1 2 3 4 5 6 7 8 9 10/.test(l)) {
        let currStart = 1;
        let j = i;
        while (j < lines.length && currStart <= 50) {
          const headerLine = lines[j].replace(/\s+/g, ' ');
          if (headerLine.startsWith(currStart + ' ')) {
            const ansLine = lines[j+1].replace(/\s+/g, ' ').split(' ');
            for (let k = 0; k < 10 && (currStart + k) <= 50; k++) {
              answers[currStart + k] = ansLine[k];
            }
            currStart += 10;
            j += 2;
          } else {
            j++;
          }
        }
        break;
      }
    }
    return answers;
  }

  // 기출 원본 PDF 보관 폴더 (새 회차 PDF는 이 폴더에 넣으면 자동 반영)
  const pdfDir = path.join(__dirname, 'pdfs');
  if (!fs.existsSync(pdfDir)) {
    throw new Error(`PDF 폴더가 없습니다: ${pdfDir}`);
  }
  const dateKey = f => (f.match(/\d{8}/) || ['99999999'])[0];
  const pdfFiles = fs.readdirSync(pdfDir)
    .filter(f => f.toLowerCase().endsWith('.pdf') && /\d{8}/.test(f))
    .sort((a, b) => dateKey(a).localeCompare(dateKey(b)));

  console.log(`Found ${pdfFiles.length} PDF exams to process in ${pdfDir}.`);

  const allExams = [];

  for (const pdfFile of pdfFiles) {
    const filePath = path.join(pdfDir, pdfFile);
    console.log(`\nProcessing: ${pdfFile}...`);

    // Parse text with pdf-parse
    const parser = new PDFParse({ data: fs.readFileSync(filePath) });
    const res = await parser.getText();
    const rawText = res.text;

    // 페이지 머리말/꼬리말/과목 구분선 등 문제 본문과 무관한 노이즈 제거
    const footerIdx = rawText.search(/전자문제집\s+CBT\s+홈페이지/);
    const bodyText = footerIdx >= 0 ? rawText.substring(0, footerIdx) : rawText;
    const tailText = footerIdx >= 0 ? rawText.substring(footerIdx) : '';
    const noiseLine = /^\s*(?:네트워크관리사\s+2급\s+◐.*|최강\s+자격증\s+기출문제.*|\d과목\s*:.*|--\s*\d+\s+of\s+\d+\s*--)\s*$/;
    const cleanedBody = bodyText.split('\n').filter(l => !noiseLine.test(l)).join('\n');
    const text = cleanedBody + '\n' + tailText;
    const bodyEnd = cleanedBody.length;

    // Date
    const dateMatch = rawText.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
    const examDate = dateMatch ? dateMatch[0].replace(/\s+/g, ' ') : '';
    const dateCodeMatch = pdfFile.match(/\d{8}/);
    const examCode = dateCodeMatch ? dateCodeMatch[0] : 'unknown';

    // Answers
    const answers = parseAnswers(text);

    // Question matches
    const regex = /(?:^|\n)\s*(\d{1,2})\.\s+/g;
    let matches = [];
    let m;
    while ((m = regex.exec(cleanedBody)) !== null) {
      const num = parseInt(m[1], 10);
      if (num >= 1 && num <= 50) {
        matches.push({ num, index: m.index, matchLen: m[0].length });
      }
    }

    // Now extract images and map them to questions using pdfjs-dist
    const pdfData = new Uint8Array(fs.readFileSync(filePath));
    const doc = await pdfjs.getDocument({ data: pdfData }).promise;

    const questionImages = {}; // qNum -> imagePath

    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const textContent = await page.getTextContent();
      const ops = await page.getOperatorList();

      // Find question positions
      const qPositions = [];
      textContent.items.forEach(item => {
        const str = item.str.trim();
        const numMatch = str.match(/^(\d{1,2})\.$/);
        if (numMatch) {
          const qNum = parseInt(numMatch[1], 10);
          if (qNum >= 1 && qNum <= 50) {
            qPositions.push({ qNum, x: item.transform[4], y: item.transform[5] });
          }
        }
      });

      let currentMatrix = [1,0,0,1,0,0];
      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        const args = ops.argsArray[i];
        if (fn === pdfjs.OPS.transform) {
          currentMatrix = args;
        } else if (fn === pdfjs.OPS.paintImageXObject) {
          const imgName = args[0];
          const imgX = currentMatrix[4];
          const imgY = currentMatrix[5];
          const isLeft = imgX < 280;

          // Find question above this image in the same column
          const sameColQuestions = qPositions.filter(q => (isLeft ? q.x < 280 : q.x >= 280) && q.y >= imgY);
          let targetQ = null;
          let minDist = Infinity;
          sameColQuestions.forEach(q => {
            const dist = q.y - imgY;
            if (dist < minDist) {
              minDist = dist;
              targetQ = q.qNum;
            }
          });

          // Special case: if at top of right column and no question above, it's the last question of left column
          if (targetQ === null && !isLeft) {
            const leftQuestions = qPositions.filter(q => q.x < 280);
            if (leftQuestions.length > 0) {
              targetQ = Math.max(...leftQuestions.map(q => q.qNum));
            }
          }

          if (targetQ) {
            // Save image
            await new Promise((resolve) => {
              page.objs.get(imgName, (img) => {
                if (img && img.data && img.width && img.height) {
                  const canvas = createCanvas(img.width, img.height);
                  const ctx = canvas.getContext('2d');
                  const imgData = ctx.createImageData(img.width, img.height);
                  if (img.kind === 1) { // Grayscale
                    for (let k = 0, j = 0; k < img.data.length; k++, j += 4) {
                      imgData.data[j] = img.data[k];
                      imgData.data[j+1] = img.data[k];
                      imgData.data[j+2] = img.data[k];
                      imgData.data[j+3] = 255;
                    }
                  } else if (img.kind === 2) { // RGB
                    for (let k = 0, j = 0; k < img.data.length; k += 3, j += 4) {
                      imgData.data[j] = img.data[k];
                      imgData.data[j+1] = img.data[k+1];
                      imgData.data[j+2] = img.data[k+2];
                      imgData.data[j+3] = 255;
                    }
                  } else if (img.kind === 3) { // RGBA
                    imgData.data.set(img.data);
                  }
                  ctx.putImageData(imgData, 0, 0);
                  const filename = `${examCode}_q${targetQ}.png`;
                  const outPath = path.join(imgOutputDir, filename);
                  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
                  questionImages[targetQ] = `images/${filename}`;
                }
                resolve();
              });
            });
          }
        }
      }
    }

    console.log(`Extracted and mapped ${Object.keys(questionImages).length} images for ${examCode}.`);

    // Parse each question
    const questions = [];
    for (let i = 0; i < matches.length; i++) {
      const num = matches[i].num;
      const start = matches[i].index + matches[i].matchLen;
      // 마지막 문제(50번)는 본문 끝(꼬리말 직전)까지만 자른다
      const end = (i < matches.length - 1) ? matches[i+1].index : bodyEnd;
      let qBlock = text.substring(start, end).trim();

      const optMatch = qBlock.match(/①([\s\S]*?)②([\s\S]*?)③([\s\S]*?)④([\s\S]*)$/);
      let questionStem = qBlock;
      let options = [];
      if (optMatch) {
        questionStem = cleanText(qBlock.substring(0, optMatch.index));
        options = [
          cleanText(optMatch[1]),
          cleanText(optMatch[2]),
          cleanText(optMatch[3]),
          cleanText(optMatch[4])
        ];
      } else {
        questionStem = cleanText(qBlock);
      }

      // Subject determination
      let subject = '1과목: TCP/IP';
      if (num >= 18 && num <= 27) subject = '2과목: 네트워크 일반';
      else if (num >= 28 && num <= 45) subject = '3과목: NOS';
      else if (num >= 46 && num <= 50) subject = '4과목: 네트워크 운용기기';

      // Explanation
      let explanation = '';
      if (examCode === '20260802' && explanations20260802[num]) {
        explanation = explanations20260802[num];
      }

      questions.push({
        num,
        subject,
        question: questionStem,
        image: questionImages[num] || null,
        options,
        answer: answers[num] || '①',
        answerNum: answers[num] ? {'①':1, '②':2, '③':3, '④':4}[answers[num]] || 1 : 1,
        explanation
      });
    }

    allExams.push({
      code: examCode,
      date: examDate || `${examCode.slice(0,4)}년 ${examCode.slice(4,6)}월 ${examCode.slice(6,8)}일`,
      title: `네트워크관리사 2급 필기 기출문제 (${examDate || examCode})`,
      questions
    });
  }

  // Save parsed data
  fs.writeFileSync(path.join(dataOutputDir, 'raw_exams.json'), JSON.stringify(allExams, null, 2), 'utf8');
  console.log(`\nSuccessfully processed all ${allExams.length} exams.`);
}

main().catch(console.error);
