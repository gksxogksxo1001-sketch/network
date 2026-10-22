const fs = require('fs');
const path = require('path');

// Read raw exams
const exams = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'raw_exams.json'), 'utf8'));

// 20260802 markdown explanations
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

// Generate explanatory knowledge base for common questions
function generateExplanation(q, examCode) {
  if (examCode === '20260802' && mdExplanations[q.num]) {
    return mdExplanations[q.num];
  }

  const stem = q.question;
  const ansText = q.options[q.answerNum - 1];
  const lines = [];

  // 1. Core logic based on question keywords
  if (stem.includes('데이터 단위') || stem.includes('PDU')) {
    lines.push(`- **계층별 PDU(데이터 전송 단위) 핵심 공식**:`);
    lines.push(`  - 1계층(물리): **비트(Bit)**`);
    lines.push(`  - 2계층(데이터 링크): **프레임(Frame)** ➔ 정답: \`${ansText}\``);
    lines.push(`  - 3계층(네트워크): **패킷(Packet)** 또는 **데이터그램(Datagram)**`);
    lines.push(`  - 4계층(전송): **세그먼트(Segment)** (TCP) / **데이터그램(Datagram)** (UDP)`);
    lines.push(`  - 5~7계층(응용): **메시지(Message) / 데이터(Data)**`);
  } else if (stem.includes('Class') && (stem.includes('유효한') || stem.includes('속한') || stem.includes('다른'))) {
    lines.push(`- **IP 주소 클래스(Class) 구분 기준**:`);
    lines.push(`  - **A Class**: 첫 옥텟 \`0 ~ 127\` (2진수 시작: \`0...\`)`);
    lines.push(`  - **B Class**: 첫 옥텟 \`128 ~ 191\` (2진수 시작: \`10...\`)`);
    lines.push(`  - **C Class**: 첫 옥텟 \`192 ~ 223\` (2진수 시작: \`110...\`)`);
    lines.push(`  - **D Class**: 첫 옥텟 \`224 ~ 239\` (2진수 시작: \`1110...\`, 멀티캐스트용)`);
    lines.push(`  - **E Class**: 첫 옥텟 \`240 ~ 255\` (연구/실험용)`);
    lines.push(`- **정답 도출**: \`${ansText}\` 조건에 부합합니다.`);
  } else if (stem.includes('서브넷') || stem.includes('subnet') || stem.includes('호스트')) {
    lines.push(`- **서브넷팅(Subnetting) 10초 컷 공식**:`);
    lines.push(`  - 서브넷 마스크의 '1' 비트는 네트워크(서브넷) 확장, '0' 비트는 가용 호스트를 결정합니다.`);
    lines.push(`  - 블록 크기(매직 넘버) = \`256 - 서브넷마스크 마지막 자리\``);
    lines.push(`  - 실제 사용 가능 호스트 수 = \`2^(호스트 비트 수) - 2\` (네트워크 ID와 브로드캐스트 주소 2개 제외)`);
    lines.push(`- **정답 분석**: 문제 조건에 맞추어 계산하면 **${ansText}**가 정확한 해답입니다.`);
  } else if (stem.includes('TTL') || stem.includes('Time To Live')) {
    lines.push(`- **TTL(Time To Live) 핵심 개념**:`);
    lines.push(`  - 패킷이 네트워크 상에서 무한 루프(Looping)를 돌며 대역폭을 낭비하는 것을 막기 위한 생명주기 타이머입니다.`);
    lines.push(`  - 라우터 1개(1 Hop)를 거칠 때마다 TTL 값이 **1씩 감소**합니다.`);
    lines.push(`  - TTL이 0이 되면 패킷은 폐기(Drop)되고 라우터가 발신지에 \`ICMP Time Exceeded\` 메시지를 전송합니다.`);
    lines.push(`- **정답**: \`${ansText}\``);
  } else if (stem.includes('IPv6')) {
    lines.push(`- **IPv6 핵심 정리**:`);
    lines.push(`  - 주소 길이: **128비트** (16진수 8개 필드, \`:\`로 구분)`);
    lines.push(`  - 기본 헤더 크기 고정: **40바이트**로 단순화하여 라우터의 처리 속도 향상 (체크섬 필드 삭제)`);
    lines.push(`  - 통신 방식: **유니캐스트(Unicast)**, **애니캐스트(Anycast)**, **멀티캐스트(Multicast)** (브로드캐스트 폐지)`);
    lines.push(`  - 보안: IPsec 기본 탑재 / 자동 주소 설정(SLAAC) 지원`);
    lines.push(`- **정답**: \`${ansText}\``);
  } else if (stem.includes('포트') || stem.includes('Port') || stem.includes('443') || stem.includes('53') || stem.includes('21') || stem.includes('22') || stem.includes('80')) {
    lines.push(`- **네트워크 필수 암기 포트 번호**:`);
    lines.push(`  - **FTP**: \`20(Data), 21(Control)\``);
    lines.push(`  - **SSH**: \`22\` / **Telnet**: \`23\` / **SMTP**: \`25\``);
    lines.push(`  - **DNS**: \`53\` / **DHCP**: \`67(서버), 68(클라이언트)\``);
    lines.push(`  - **HTTP**: \`80\` / **HTTPS**: \`443\``);
    lines.push(`  - **SNMP**: \`161(Query), 162(Trap)\``);
    lines.push(`- **정답**: \`${ansText}\``);
  } else if (stem.includes('ICMP')) {
    lines.push(`- **ICMP(Internet Control Message Protocol) 핵심**:`);
    lines.push(`  - 계층: **네트워크(인터넷) 3계층** 프로토콜 (IP 프로토콜 번호 1)`);
    lines.push(`  - 주 역할: 네트워크 통신 상태 진단(핑 \`ping\`, 경로추적 \`tracert\`) 및 오류 보고(Error Reporting)`);
    lines.push(`  - 에러 제어 메시지: Destination Unreachable, Time Exceeded, Echo Request/Reply`);
    lines.push(`- **정답**: \`${ansText}\``);
  } else if (stem.includes('DNS') || stem.includes('도메인')) {
    lines.push(`- **DNS 레코드 및 동작 원리**:`);
    lines.push(`  - **A 레코드**: 도메인 ➔ IPv4 주소 매핑`);
    lines.push(`  - **AAAA 레코드**: 도메인 ➔ IPv6 주소 매핑`);
    lines.push(`  - **PTR 레코드**: IP 주소 ➔ 도메인 (역방향 조회)`);
    lines.push(`  - **CNAME**: 도메인의 별칭(Alias) 지정`);
    lines.push(`  - **MX**: 메일 교환 서버(Mail Exchanger)`);
    lines.push(`  - **SOA**: 영역의 시작(Start of Authority), 버전 관리 시리얼 및 TTL 지정`);
    lines.push(`- **정답**: \`${ansText}\``);
  } else if (stem.includes('Linux') || stem.includes('리눅스') || stem.includes('/etc/') || stem.includes('명령어')) {
    lines.push(`- **리눅스 시스템 & 네트워크 핵심 포인트**:`);
    lines.push(`  - \`/etc/hosts\`: 로컬 IP-호스트명 매핑 (DNS 조회 전 우선 참조)`);
    lines.push(`  - \`/etc/resolv.conf\`: 사용할 네임서버(DNS) IP 주소 설정`);
    lines.push(`  - \`/etc/services\`: 표준 서비스명과 포트 번호/프로토콜 매핑 파일`);
    lines.push(`  - \`chmod\`: 파일 권한 변경 (r=4, w=2, x=1)`);
    lines.push(`  - \`netstat\`: 네트워크 연결 상태, 라우팅 테이블, 인터페이스 통계 확인`);
    lines.push(`- **정답 분석**: 문제에서 요구하는 기능/파일은 **${ansText}**입니다.`);
  } else if (stem.includes('Windows') || stem.includes('윈도우') || stem.includes('Active Directory') || stem.includes('RAID')) {
    lines.push(`- **Windows Server 및 저장소 핵심 요약**:`);
    lines.push(`  - **RAID-0**: 스트라이핑(성능 극대화, 결함 허용 안 됨)`);
    lines.push(`  - **RAID-1**: 미러링(동일 데이터 복제, 디스크 용량 50% 사용)`);
    lines.push(`  - **RAID-5**: 패리티 분산 저장(최소 3개 디스크 필요, 1개 디스크 결함 허용)`);
    lines.push(`  - **Active Directory(AD)**: 중앙 집중식 디렉터리 서비스 (도메인 컨트롤러 관리)`);
    lines.push(`- **정답**: \`${ansText}\``);
  } else if (stem.includes('스위치') || stem.includes('라우터') || stem.includes('VLAN') || stem.includes('STP')) {
    lines.push(`- **네트워크 운용기기 핵심 정리**:`);
    lines.push(`  - **L2 스위치**: MAC 주소 기반 패킷 포워딩 (데이터 링크 계층)`);
    lines.push(`  - **L3 스위치/라우터**: IP 주소 기반 최적 경로 라우팅 (네트워크 계층)`);
    lines.push(`  - **L4 스위치**: 포트 번호/전송 계층 헤더 기반 부하 분산(Load Balancing)`);
    lines.push(`  - **VLAN**: 물리적 스위치를 논리적으로 분할하여 브로드캐스트 도메인 격리`);
    lines.push(`  - **STP(Spanning Tree Protocol)**: 이중화 스위치 구성 시 브로드캐스트 스톰(루핑) 방지`);
    lines.push(`- **정답**: \`${ansText}\``);
  } else {
    lines.push(`- **핵심 풀이 요약**:`);
    lines.push(`  - 출제 의도: 네트워크관리사 2급 ${q.subject} 영역의 빈출 기본 개념입니다.`);
    lines.push(`  - 문제의 조건에 가장 부합하는 정답은 **${ansText}**입니다.`);
    lines.push(`  - 다른 오답 보기들은 서로 다른 계층이거나 상반된 용어이므로 주의해야 합니다.`);
  }

  // 2. Add options review
  lines.push(`- **보기 분석**:`);
  q.options.forEach((opt, idx) => {
    const isCorrect = (idx + 1) === q.answerNum;
    const mark = isCorrect ? '✔️ **[정답]**' : '❌';
    lines.push(`  - ${['①','②','③','④'][idx]} ${opt} ${mark}`);
  });

  return lines.join('\n');
}

// Process all exams and build final JSON
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

// Write to exam_data.js for direct script tag loading
const totalQ = finalExams.reduce((s, e) => s + e.questions.length, 0);
const jsContent = `/**
 * 네트워크관리사 2급 필기 ${finalExams.length}개 회차 기출문제 및 정답/해설 데이터베이스
 * 총 ${finalExams.length}회차 (${finalExams[0].date} ~ ${finalExams[finalExams.length - 1].date}) ${totalQ}문항
 */
window.EXAM_DATA = ${JSON.stringify(finalExams, null, 2)};
`;

fs.writeFileSync(path.join(__dirname, 'data', 'exam_data.js'), jsContent, 'utf8');
fs.writeFileSync(path.join(__dirname, 'data', 'exam_data.json'), JSON.stringify(finalExams, null, 2), 'utf8');

console.log('Successfully generated data/exam_data.js and data/exam_data.json');
