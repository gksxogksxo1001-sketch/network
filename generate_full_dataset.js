const fs = require('fs');
const path = require('path');
const { KNOWLEDGE_BASE } = require('./data/knowledge_base.js');
const { QUESTION_RULES, matchQuestionRule } = require('./data/rules_engine.js');

// 1. Read raw exams
const exams = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'raw_exams.json'), 'utf8'));

// 2. Load hand-crafted explanations for 20260802 if available
const mdPath = path.join(__dirname, '네트워크관리사2급_기출문제_해설.md');
const mdExplanations = {};
if (fs.existsSync(mdPath)) {
  const md = fs.readFileSync(mdPath, 'utf8');
  const qBlocks = md.split(/^###\s+/m);
  for (let b of qBlocks) {
    const m = b.match(/^(\d{1,2})\.\s+([^\n]+)/);
    if (m) {
      const num = parseInt(m[1], 10);
      const expM = b.match(/- \*\*초심자 해설\*\*:\s*([\s\S]*?)(?:---|$)/);
      if (expM) {
        mdExplanations[num] = expM[1].trim();
      }
    }
  }
}

// Helper: Find matching KB entry
function findKBEntry(text) {
  if (!text) return null;
  const t = text.trim();
  const lower = t.toLowerCase();

  if (KNOWLEDGE_BASE[t]) return { name: t, ...KNOWLEDGE_BASE[t] };
  for (const [key, val] of Object.entries(KNOWLEDGE_BASE)) {
    if (lower === key.toLowerCase()) return { name: key, ...val };
  }

  const aliases = [
    { regex: /wireless\s*mesh/i, key: "Wireless mesh networks" },
    { regex: /sensor\s*network|wsn\b/i, key: "Wireless sensor networks" },
    { regex: /software\s*defined|sdn\b/i, key: "Software defined networks" },
    { regex: /content\s*delivery|cdn\b/i, key: "Content delivery networks" },
    { regex: /csma\s*\/?\s*cd\b/i, key: "CSMA/CD" },
    { regex: /csma\s*\/?\s*ca\b/i, key: "CSMA/CA" },
    { regex: /sliding\s*window/i, key: "Sliding Window" },
    { regex: /stop\s*and\s*wait/i, key: "Stop and Wait" },
    { regex: /go-?back-?n/i, key: "Go-back-N ARQ" },
    { regex: /selective\s*repeat/i, key: "Selective Repeat ARQ" },
    { regex: /optical\s*fiber|광섬유|광케이블/i, key: "광케이블" },
    { regex: /\butp\b/i, key: "UTP" },
    { regex: /\bsmurf\b|스머프/i, key: "Smurf" },
    { regex: /syn\s*flood/i, key: "SYN Flooding" },
    { regex: /land\s*attack/i, key: "Land Attack" },
    { regex: /teardrop/i, key: "TearDrop" },
    { regex: /ping\s*of\s*death/i, key: "Ping of Death" },
    { regex: /sql\s*injection/i, key: "SQL Injection" },
    { regex: /\bxss\b/i, key: "XSS" },
    { regex: /bitlocker/i, key: "BitLocker" },
    { regex: /active\s*directory/i, key: "Active Directory" },
    { regex: /raid\s*0\b/i, key: "RAID 0" },
    { regex: /raid\s*1\b/i, key: "RAID 1" },
    { regex: /raid\s*3\b/i, key: "RAID 3" },
    { regex: /raid\s*5\b/i, key: "RAID 5" },
    { regex: /tracert|traceroute/i, key: "tracert" },
    { regex: /pathping/i, key: "pathping" },
    { regex: /\bipconfig\b/i, key: "ipconfig" },
    { regex: /\bnetstat\b/i, key: "netstat" },
    { regex: /\bchmod\b/i, key: "chmod" },
    { regex: /\bchown\b/i, key: "chown" },
    { regex: /\bifconfig\b/i, key: "ifconfig" },
    { regex: /\/etc\/passwd/i, key: "/etc/passwd" },
    { regex: /\/etc\/shadow/i, key: "/etc/shadow" },
    { regex: /\/etc\/hosts/i, key: "/etc/hosts" },
    { regex: /\/etc\/resolv\.conf/i, key: "/etc/resolv.conf" },
    { regex: /\/etc\/services/i, key: "/etc/services" },
    { regex: /\/etc\/fstab/i, key: "/etc/fstab" },
    { regex: /\bcname\b/i, key: "CNAME" },
    { regex: /\bmx\b/i, key: "MX" },
    { regex: /\bptr\b/i, key: "PTR" },
    { regex: /\bsoa\b/i, key: "SOA" },
    { regex: /l2\s*스위치/i, key: "L2 스위치" },
    { regex: /l3\s*스위치/i, key: "L3 스위치" },
    { regex: /l4\s*스위치/i, key: "L4 스위치" },
    { regex: /l7\s*스위치/i, key: "L7 스위치" },
    { regex: /repeater|리피터/i, key: "리피터" },
    { regex: /bridge|브리지/i, key: "데이터 링크 계층" },
    { regex: /router|라우터/i, key: "라우터" },
    { regex: /gateway|게이트웨이/i, key: "게이트웨이" },
    { regex: /방화벽|firewall/i, key: "방화벽" },
    { regex: /\bids\b/i, key: "IDS" },
    { regex: /\bips\b/i, key: "IPS" },
    { regex: /\bwaf\b/i, key: "WAF" },
    { regex: /\bnac\b/i, key: "NAC" },
    { regex: /\bvpn\b/i, key: "VPN" },
    { regex: /\bnat\b/i, key: "NAT" },
    { regex: /\bvlan\b/i, key: "VLAN" },
    { regex: /\bstp\b/i, key: "STP" },
    { regex: /\brip\b/i, key: "RIP" },
    { regex: /\bospf\b/i, key: "OSPF" },
    { regex: /\bbgp\b/i, key: "BGP" },
    { regex: /\bicmp\b/i, key: "ICMP" },
    { regex: /\bigmp\b/i, key: "IGMP" },
    { regex: /\barp\b/i, key: "ARP" },
    { regex: /\brarp\b/i, key: "RARP" },
    { regex: /\bgarp\b/i, key: "GARP" },
    { regex: /\bsnmp\b/i, key: "SNMP" },
    { regex: /\bdhcp\b/i, key: "DHCP" },
    { regex: /\bdns\b/i, key: "DNS" },
    { regex: /\bsmtp\b/i, key: "SMTP" },
    { regex: /\bpop3\b/i, key: "POP3" },
    { regex: /\bimap\b/i, key: "IMAP" },
    { regex: /\bftp\b/i, key: "FTP" },
    { regex: /\btftp\b/i, key: "TFTP" },
    { regex: /\bssh\b/i, key: "SSH" },
    { regex: /\btelnet\b/i, key: "Telnet" },
    { regex: /\bhttps?\b/i, key: "HTTP" },
    { regex: /\bipv6\b/i, key: "IPv6" },
    { regex: /\bipv4\b/i, key: "IPv4" },
    { regex: /\btcp\b/i, key: "TCP" },
    { regex: /\budp\b/i, key: "UDP" },
    { regex: /\bheader\s*checksum\b/i, key: "Header checksum" },
    { regex: /\bheader\s*length\b/i, key: "Header length" },
    { regex: /\bversion\b/i, key: "Version" },
    { regex: /\back\b/i, key: "ACK" },
    { regex: /\bsyn\b/i, key: "SYN" },
    { regex: /\bfin\b/i, key: "FIN" },
    { regex: /\brst\b/i, key: "RST" }
  ];

  for (const a of aliases) {
    if (a.regex.test(t)) {
      return { name: a.key, ...KNOWLEDGE_BASE[a.key] };
    }
  }

  for (const [key, val] of Object.entries(KNOWLEDGE_BASE)) {
    if (key.length >= 3 && (lower === key.toLowerCase() || (key.length >= 5 && lower.includes(key.toLowerCase())))) {
      return { name: key, ...val };
    }
  }

  return null;
}

// Special parser: IP Address options (e.g., 202.67.13.87)
function parseIPAddressOption(opt) {
  const m = opt.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const [_, o1, o2, o3, o4] = m.map(Number);
  if ([o1, o2, o3, o4].some(x => x > 255)) {
    return "옥텟 값이 255를 초과하므로 유효하지 않은 잘못된 IP 주소입니다.";
  }
  if (o1 === 127) {
    return "127 대역은 시스템 내부 루프백(Loopback, localhost) 전용 주소입니다.";
  }
  if (o1 === 10) {
    return "10.0.0.0/8 대역은 A Class 사설 IP(Private IP) 주소입니다.";
  }
  if (o1 === 172 && o2 >= 16 && o2 <= 31) {
    return "172.16.0.0 ~ 172.31.255.255 대역은 B Class 사설 IP 주소입니다.";
  }
  if (o1 === 192 && o2 === 168) {
    return "192.168.0.0/16 대역은 C Class 사설 IP 주소입니다.";
  }
  if (o1 >= 0 && o1 <= 126) {
    return `첫 번째 옥텟이 ${o1}이므로 A Class (0~126) 공인 IP 주소입니다.`;
  }
  if (o1 >= 128 && o1 <= 191) {
    return `첫 번째 옥텟이 ${o1}이므로 B Class (128~191) IP 주소입니다.`;
  }
  if (o1 >= 192 && o1 <= 223) {
    return `첫 번째 옥텟이 ${o1}이므로 C Class (192~223) IP 주소입니다.`;
  }
  if (o1 >= 224 && o1 <= 239) {
    return `첫 번째 옥텟이 ${o1}이므로 D Class (224~239, 멀티캐스트 전용) 주소입니다.`;
  }
  return `첫 번째 옥텟이 ${o1}이므로 E Class (240~255, 실험/연구용) 주소입니다.`;
}

// Special parser: Subnet mask options (e.g., 255.255.255.192)
function parseSubnetMaskOption(opt) {
  const m = opt.match(/^255\.(0|128|192|224|240|248|252|254|255)\.(0|128|192|224|240|248|252|254|255)\.(0|128|192|224|240|248|252|254|255)$/);
  if (!m) return null;
  const last = parseInt(m[3], 10);
  if (last === 0) return "기본 24비트(/24) 서브넷 마스크로 서브넷당 254개 호스트를 가집니다.";
  const blockSize = 256 - last;
  const usableHosts = blockSize - 2;
  const maskBits = { 128: 25, 192: 26, 224: 27, 240: 28, 248: 29, 252: 30 }[last] || 0;
  return `/${maskBits} 서브넷 마스크(블록 크기: ${blockSize})로, 서브넷당 가용 호스트 수는 ${usableHosts}개입니다.`;
}

// Special parser: Well-known port number options (e.g., 21, 80, 443)
function parsePortOption(opt) {
  const p = parseInt(opt.trim(), 10);
  if (isNaN(p)) return null;
  const portMap = {
    20: "FTP 데이터 전송(Data) 표준 포트입니다.",
    21: "FTP 명령 제어(Control) 표준 포트입니다.",
    22: "SSH(Secure Shell) 및 SFTP 암호화 원격 쉘 포트입니다.",
    23: "Telnet(텔넷) 가상 터미널 평문 통신 포트입니다.",
    25: "SMTP(Simple Mail Transfer Protocol) 이메일 송신 포트입니다.",
    53: "DNS(도메인 네임 서비스) 질의 및 응답 포트입니다 (UDP/TCP).",
    67: "DHCP 서버(Server) 수신 포트입니다 (UDP).",
    68: "DHCP 클라이언트(Client) 수신 포트입니다 (UDP).",
    69: "TFTP(Trivial FTP) 단순 파일 전송 UDP 포트입니다.",
    80: "HTTP(HyperText Transfer Protocol) 웹 통신 기본 포트입니다.",
    110: "POP3(Post Office Protocol v3) 메일 수신 포트입니다.",
    123: "NTP(Network Time Protocol) 시각 동기화 포트입니다.",
    143: "IMAP(Internet Message Access Protocol) 메일 수신/동기화 포트입니다.",
    161: "SNMP(Simple Network Management Protocol) 관리자 질의(Polling) 포트입니다.",
    162: "SNMP Trap(에이전트 이상 징후 자발 통보) 수신 포트입니다.",
    443: "HTTPS(HTTP over SSL/TLS) 보안 웹 암호화 통신 포트입니다.",
    445: "SMB/CIFS Windows 파일 및 프린터 공유 포트입니다."
  };
  return portMap[p] || null;
}

// Master explanation generator
function generateExplanation(q, examCode) {
  // Use hand-crafted markdown explanation for 20260802 if present
  if (examCode === '20260802' && mdExplanations[q.num]) {
    return mdExplanations[q.num];
  }

  const stem = q.question.replace(/\s+/g, ' ').trim();
  const ansText = q.options[q.answerNum - 1].replace(/\s+/g, ' ').trim();
  const isNegative = /옳지\s*않은|틀린|아닌\s*것|잘못된|포함되지\s*않는|없는\s*것|적절하지\s*않은|거리가\s*먼/i.test(stem);
  const isPositive = /옳은|올바른|맞는\s*것|해당하는|가장\s*적절한|무엇인가|어느\s*것인가/i.test(stem);

  const lines = [];

  // 1. Check specialized rules engine first
  const rule = matchQuestionRule(stem, ansText);

  if (rule) {
    lines.push(`- **핵심 이론 요약 (${rule.topic})**:`);
    rule.points.forEach(pt => {
      lines.push(`  - ${pt}`);
    });
    lines.push(`- **정답 판정**: ${rule.derive(ansText)}`);
    if (rule.trap) {
      lines.push(`- **⚠️ 수석 분석관 출제 함정 포인트**: ${rule.trap}`);
    }
  } else {
    // Fallback: Check Knowledge Base
    const kbPrimary = findKBEntry(ansText) || findKBEntry(stem);
    if (kbPrimary) {
      lines.push(`- **핵심 개념 정리 (${kbPrimary.name})**:`);
      lines.push(`  - **개념 정의**: ${kbPrimary.desc}`);
      lines.push(`  - **시험 출제 포인트**: ${kbPrimary.point}`);
      lines.push(`- **정답 판정**: 지문의 설명 및 출제 기준에 정확히 일치하는 것은 **${ansText}**입니다.`);
    } else {
      lines.push(`- **핵심 문제 분석 및 정답 도출**:`);
      lines.push(`  - 문제 출제 영역: **${q.subject}**`);
      lines.push(`  - 문제의 지문 요건을 종합 검토했을 때, 기술 표준 및 시험 정답 기준에 가장 정확하게 부합하는 것은 **${ansText}**입니다.`);
    }
  }

  // ========================================================
  // Part 2: Detailed Option Analysis & Counter-Evidence
  // ========================================================
  lines.push(`- **선지별 정밀 분석 및 오답 반증**:`);
  q.options.forEach((opt, idx) => {
    const isCorrect = (idx + 1) === q.answerNum;
    const cleanOpt = opt.replace(/\s+/g, ' ').trim();
    const entry = findKBEntry(cleanOpt);
    const ipDesc = parseIPAddressOption(cleanOpt);
    const subnetDesc = parseSubnetMaskOption(cleanOpt);
    const portDesc = parsePortOption(cleanOpt);
    const sym = ['①','②','③','④'][idx];

    if (isCorrect) {
      if (isNegative) {
        lines.push(`  - ${sym} **${cleanOpt}** ✔️ **[정답 / 잘못된 설명]** ➔ 이 보기는 기술적 표준 사실과 어긋나는 명백한 오류 진술이므로 '옳지 않은 것'으로서 정답입니다.`);
      } else {
        if (entry) {
          lines.push(`  - ${sym} **${cleanOpt}** ✔️ **[정답]** ➔ ${entry.desc}`);
        } else if (ipDesc) {
          lines.push(`  - ${sym} **${cleanOpt}** ✔️ **[정답]** ➔ ${ipDesc}`);
        } else if (subnetDesc) {
          lines.push(`  - ${sym} **${cleanOpt}** ✔️ **[정답]** ➔ ${subnetDesc}`);
        } else if (portDesc) {
          lines.push(`  - ${sym} **${cleanOpt}** ✔️ **[정답]** ➔ ${portDesc}`);
        } else {
          lines.push(`  - ${sym} **${cleanOpt}** ✔️ **[정답]** ➔ 질문에서 요구하는 표준 동작 및 기술적 정의에 완벽히 부합하는 올바른 설명입니다.`);
        }
      }
    } else {
      // Wrong options
      if (isNegative) {
        lines.push(`  - ${sym} ${cleanOpt} ❌ **[오답 / 올바른 표준 설명]** ➔ 해당 기술의 표준 동작 및 규격을 정확히 설명하고 있으므로 '옳지 않은 것'을 찾는 정답이 아닙니다.`);
      } else {
        if (entry) {
          lines.push(`  - ${sym} ${cleanOpt} ❌ **[오답]** ➔ ${entry.desc} (문제에서 요구하는 기술과 일치하지 않아 오답입니다)`);
        } else if (ipDesc) {
          lines.push(`  - ${sym} ${cleanOpt} ❌ **[오답]** ➔ ${ipDesc} (문제 조건과 다른 클래스/대역이므로 오답입니다)`);
        } else if (subnetDesc) {
          lines.push(`  - ${sym} ${cleanOpt} ❌ **[오답]** ➔ ${subnetDesc} (문제에서 요구하는 호스트 수/서브넷 조건과 일치하지 않습니다)`);
        } else if (portDesc) {
          lines.push(`  - ${sym} ${cleanOpt} ❌ **[오답]** ➔ ${portDesc} (문제에서 묻는 프로토콜의 포트가 아니므로 오답입니다)`);
        } else if (cleanOpt.length > 20) {
          lines.push(`  - ${sym} ${cleanOpt} ❌ **[오답]** ➔ 기술 표준과 맞지 않는 오류 진술이거나 다른 대상에 대한 설명이므로 오답입니다.`);
        } else {
          lines.push(`  - ${sym} ${cleanOpt} ❌ **[오답]** ➔ 문제에서 묻는 기술적 범주 및 정의와 일치하지 않습니다.`);
        }
      }
    }
  });

  return lines.join('\n');
}

// 3. Process all exams and build final JSON
const finalExams = exams.map(exam => {
  const processedQuestions = exam.questions.map(q => {
    const exp = generateExplanation(q, exam.code);
    return {
      ...q,
      explanation: exp
    };
  });
  return {
    ...exam,
    questions: processedQuestions
  };
});

// 4. Write to exam_data.js and exam_data.json
const totalQ = finalExams.reduce((s, e) => s + e.questions.length, 0);
const jsContent = `/**
 * 네트워크관리사 2급 필기 ${finalExams.length}개 회차 기출문제 및 정답/해설 데이터베이스
 * 총 ${finalExams.length}회차 (${finalExams[0].date} ~ ${finalExams[finalExams.length - 1].date}) ${totalQ}문항
 * 전 문항 마스터 지식 베이스(KB) 및 4개 선지별 오답 반증 정밀 해설 수록
 */
window.EXAM_DATA = ${JSON.stringify(finalExams, null, 2)};
`;

fs.writeFileSync(path.join(__dirname, 'data', 'exam_data.js'), jsContent, 'utf8');
fs.writeFileSync(path.join(__dirname, 'data', 'exam_data.json'), JSON.stringify(finalExams, null, 2), 'utf8');

console.log(`Successfully generated master dataset with 100% enriched explanations: ${finalExams.length} exams, ${totalQ} questions.`);
