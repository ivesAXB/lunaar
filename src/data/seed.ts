import { addDays, format, subDays } from 'date-fns';
import type {
  Accommodation,
  Animal,
  AnimalEvent,
  AnimalHealthRecord,
  AnimalTreatment,
  AnimalVaccine,
  Booking,
  BookingCheckin,
  BookingCheckout,
  Client,
  ClientPet,
  Database,
  Kennel,
  User,
} from './types';
import { makeCpf } from '@/lib/format';
import { kennelPath } from '@/lib/kennel';

/**
 * Dados de exemplo gerados a partir da data de hoje, para que o sistema
 * sempre abra com uma situação plausível (hospedagens terminando hoje,
 * vacinas vencendo, adoções recentes etc.).
 */
export const SEED_VERSION = 6;

export function createSeed(today = new Date()): Database {
  const d = (offset: number) => format(addDays(today, offset), 'yyyy-MM-dd');
  const dt = (offset: number, time: string) => `${d(offset)}T${time}:00`;
  const nowIso = today.toISOString();
  const photo = (file: string) => `/photos/${file}.jpg`;

  const users: User[] = [
    { id: 'u1', name: 'Mariana Couto', email: 'mariana@lunaar.org', role: 'coordenacao', active: true, password: 'lunaar2026' },
    { id: 'u2', name: 'Dra. Camila Rezende', email: 'camila.vet@lunaar.org', role: 'veterinaria', active: true, password: 'lunaar2026' },
    { id: 'u3', name: 'Rafael Nunes', email: 'rafael@lunaar.org', role: 'equipe', active: true, password: 'lunaar2026' },
    { id: 'u4', name: 'Joana Prado', email: 'joana@lunaar.org', role: 'equipe', active: true, password: 'lunaar2026' },
    { id: 'u5', name: 'Diego Alves', email: 'diego@lunaar.org', role: 'equipe', active: false, password: 'lunaar2026' },
  ];

  const kennels: Kennel[] = [
    { id: 'k1', location: 'Sede Coxipó', sector: 'Cães', wing: 'A', number: '01', kind: 'canil', capacity: 4 },
    { id: 'k2', location: 'Sede Coxipó', sector: 'Cães', wing: 'A', number: '02', kind: 'canil', capacity: 4 },
    { id: 'k3', location: 'Sede Coxipó', sector: 'Cães', wing: 'B', number: '03', kind: 'canil', capacity: 4 },
    { id: 'k4', location: 'Sede Coxipó', sector: 'Cães', wing: 'B', number: '04', kind: 'canil', capacity: 3, notes: 'Reservado para idosos: piso emborrachado e sombra.' },
    { id: 'k5', location: 'Sede Coxipó', sector: 'Gatos', wing: 'C', number: '01', kind: 'gatil', capacity: 8 },
    { id: 'k6', location: 'Sede Coxipó', sector: 'Clínico', wing: 'D', number: '01', kind: 'enfermaria', capacity: 6, notes: 'Inclui baias de isolamento para doenças contagiosas.' },
    { id: 'k7', location: 'Lares temporários', sector: 'Famílias voluntárias', wing: 'LT', number: '01', kind: 'lar_temporario', capacity: 4 },
  ];

  type A = Omit<Animal, 'updatedAt' | 'neutered'> & { neutered?: boolean };
  const raw: A[] = [
    {
      id: 'a01', name: 'Thor', species: 'cao', breed: 'SRD', sex: 'macho', color: 'Preto', weightKg: 24.5,
      ageApproxMonths: 30, size: 'grande', status: 'disponivel', photo: photo('dog-01-groenendael'),
      intakeDate: d(-64), kennelId: 'k1', origin: 'resgate', originNotes: 'Encontrado amarrado em terreno baldio no bairro Pedra 90.',
      responsibleId: 'u3', temperament: 'Dócil com pessoas, seletivo com outros machos.', lastVetVisit: d(-21), neutered: false,
      vetNotes: 'Saudável. Castração a agendar antes da adoção.',
    },
    {
      id: 'a02', name: 'Mel', species: 'cao', breed: 'SRD', sex: 'femea', color: 'Caramelo claro', weightKg: 11.2,
      ageApproxMonths: 48, size: 'medio', status: 'disponivel', photo: photo('dog-26-terrier-tibetan'),
      intakeDate: d(-142), kennelId: 'k2', origin: 'entrega_voluntaria', originNotes: 'Tutora se mudou para apartamento que não aceita animais.',
      responsibleId: 'u4', temperament: 'Muito carinhosa, convive bem com gatos.', lastVetVisit: d(-40), neutered: true,
    },
    {
      id: 'a03', name: 'Luna', species: 'cao', breed: 'SRD (mestiça de pastor)', sex: 'femea', color: 'Castanho e preto', weightKg: 22,
      ageApproxMonths: 20, size: 'grande', status: 'reservado', photo: photo('dog-27-malinois'),
      intakeDate: d(-90), kennelId: 'k1', origin: 'resgate', responsibleId: 'u3', lastVetVisit: d(-15), neutered: true,
      temperament: 'Enérgica e inteligente. Precisa de espaço e passeios diários.',
    },
    {
      id: 'a04', name: 'Nina', species: 'cao', breed: 'SRD (mestiça de border collie)', sex: 'femea', color: 'Preto e branco', weightKg: 14.8,
      ageApproxMonths: 26, size: 'medio', status: 'disponivel', photo: photo('dog-32-collie-border'),
      intakeDate: d(-51), kennelId: 'k2', origin: 'abandono', originNotes: 'Deixada no portão da ONG.', responsibleId: 'u4',
      lastVetVisit: d(-30), neutered: true, temperament: 'Brincalhona, ótima com crianças.',
    },
    {
      id: 'a05', name: 'Amora', species: 'cao', breed: 'Pinscher', sex: 'femea', color: 'Preto e ferrugem', weightKg: 3.4,
      ageApproxMonths: 72, size: 'pequeno', status: 'disponivel', photo: photo('dog-39-terrier-toy'),
      intakeDate: d(-33), kennelId: 'k3', origin: 'entrega_voluntaria', responsibleId: 'u3', lastVetVisit: d(-33), neutered: true,
      temperament: 'Desconfiada no início, depois muito apegada.',
    },
    {
      id: 'a06', name: 'Simba', species: 'cao', breed: 'SRD (mestiço de pastor alemão)', sex: 'macho', color: 'Preto e castanho', weightKg: 28.3,
      ageApproxMonths: 60, size: 'grande', status: 'disponivel', photo: photo('dog-30-german-shepherd'),
      intakeDate: d(-210), kennelId: 'k1', origin: 'resgate', originNotes: 'Resgatado de maus-tratos (denúncia via Delegacia Especializada).',
      responsibleId: 'u3', lastVetVisit: d(-60), neutered: true, temperament: 'Protetor e leal. Indicado para casa com quintal.',
    },
    {
      id: 'a07', name: 'Estopinha', species: 'cao', breed: 'SRD', sex: 'femea', color: 'Bege', weightKg: 9.1,
      ageApproxMonths: 36, size: 'medio', status: 'tratamento', photo: photo('dog-16-briard'),
      intakeDate: d(-18), kennelId: 'k6', origin: 'resgate', responsibleId: 'u2', lastVetVisit: d(-4), neutered: false,
      diseases: 'Erliquiose (doença do carrapato)', vetNotes: 'Plaquetas em recuperação. Repetir hemograma ao fim do ciclo de doxiciclina.',
    },
    {
      id: 'a08', name: 'Chico', species: 'cao', breed: 'SRD', sex: 'macho', color: 'Branco e laranja', weightKg: 17.6,
      ageApproxMonths: 120, size: 'medio', status: 'tratamento', photo: photo('dog-18-clumber'),
      intakeDate: d(-75), kennelId: 'k4', origin: 'abandono', responsibleId: 'u2', lastVetVisit: d(-9), neutered: true,
      diseases: 'Dermatite alérgica; artrose leve', allergies: 'Frango (alimentar)', vetNotes: 'Idoso. Ração hipoalergênica. Banho terapêutico semanal.',
      temperament: 'Calmo, gosta de ficar deitado ao sol.',
    },
    {
      id: 'a09', name: 'Duque', species: 'cao', breed: 'SRD', sex: 'macho', color: 'Preto e castanho', weightKg: 31,
      ageApproxMonths: 40, size: 'grande', status: 'tratamento', photo: photo('dog-05-mastiff-tibetan'),
      intakeDate: d(-26), kennelId: 'k6', origin: 'resgate', responsibleId: 'u2', lastVetVisit: d(-3), neutered: true,
      vetNotes: 'Pós-operatório de castração. Retirada de pontos prevista.',
    },
    {
      id: 'a10', name: 'Caramelo', species: 'cao', breed: 'SRD', sex: 'macho', color: 'Caramelo', weightKg: 26,
      ageApproxMonths: 84, size: 'grande', status: 'disponivel', photo: photo('dog-11-ovcharka-caucasian'),
      intakeDate: d(-320), kennelId: 'k4', origin: 'resgate', responsibleId: 'u3', lastVetVisit: d(-200), neutered: true,
      temperament: 'Tranquilo. Está há mais tempo no abrigo.',
    },
    {
      id: 'a11', name: 'Brisa', species: 'cao', breed: 'SRD (mestiça de husky)', sex: 'femea', color: 'Cinza e branco', weightKg: 19.4,
      ageApproxMonths: 30, size: 'grande', status: 'observacao', photo: photo('dog-19-husky'),
      intakeDate: d(-4), kennelId: 'k6', origin: 'resgate', originNotes: 'Resgatada na BR-364, sem ferimentos aparentes.',
      responsibleId: 'u2', lastVetVisit: d(-4), neutered: false, vetNotes: 'Quarentena de 10 dias antes de ir para canil coletivo.',
    },
    {
      id: 'a12', name: 'Zeca', species: 'cao', breed: 'SRD', sex: 'macho', color: 'Marrom', weightKg: 21.7,
      ageApproxMonths: 54, size: 'grande', status: 'disponivel', photo: photo('dog-22-mix'),
      intakeDate: d(-110), kennelId: 'k3', origin: 'transferencia', originNotes: 'Transferido do CCZ de Várzea Grande.',
      responsibleId: 'u4', lastVetVisit: d(-45), neutered: true, temperament: 'Adora dormir no sofá. Sociável.',
    },
    {
      id: 'a13', name: 'Fubá', species: 'cao', breed: 'SRD', sex: 'macho', color: 'Tricolor', weightKg: 8.3,
      ageApproxMonths: 18, size: 'pequeno', status: 'disponivel', photo: photo('dog-24-terrier-fox'),
      intakeDate: d(-47), kennelId: 'k3', origin: 'abandono', responsibleId: 'u4', lastVetVisit: d(-47), neutered: true,
    },
    {
      id: 'a14', name: 'Urso', species: 'cao', breed: 'SRD', sex: 'macho', color: 'Cinza e preto', weightKg: 23,
      ageApproxMonths: 66, size: 'grande', status: 'atencao', photo: photo('dog-25-keeshond'),
      intakeDate: d(-150), kennelId: 'k2', origin: 'resgate', responsibleId: 'u2', lastVetVisit: d(-2), neutered: true,
      vetNotes: 'Perda de apetite há 3 dias e apatia. Suspeita de gastrite; aguardando resultado de exames.',
    },
    {
      id: 'a15', name: 'Tobias', species: 'cao', breed: 'SRD', sex: 'macho', color: 'Preto e castanho', weightKg: 25.1,
      ageApproxMonths: 34, size: 'grande', status: 'reservado', photo: photo('dog-15-setter-gordon'),
      intakeDate: d(-58), kennelId: 'k1', origin: 'resgate', responsibleId: 'u3', lastVetVisit: d(-20), neutered: true,
    },
    {
      id: 'a16', name: 'Bidu', species: 'cao', breed: 'SRD', sex: 'macho', color: 'Branco', weightKg: 12,
      ageApproxMonths: 96, size: 'medio', status: 'disponivel', photo: photo('dog-04-clumber'),
      intakeDate: d(-260), kennelId: 'k4', origin: 'entrega_voluntaria', responsibleId: 'u4', lastVetVisit: d(-35), neutered: true,
      temperament: 'Idoso muito tranquilo, ideal para apartamento.',
    },
    {
      id: 'a17', name: 'Paçoca', species: 'cao', breed: 'SRD', sex: 'femea', color: 'Caramelo', size: 'medio',
      ageApproxMonths: 8, status: 'observacao', intakeDate: d(-2), kennelId: 'k6', origin: 'resgate',
      originNotes: 'Filhote resgatada com a ninhada na região do Coxipó.', neutered: false,
    },
    // Gatos
    {
      id: 'a18', name: 'Salem', species: 'gato', breed: 'SRD', sex: 'macho', color: 'Preto', weightKg: 4.6,
      ageApproxMonths: 36, size: 'pequeno', status: 'disponivel', photo: photo('cat-01'),
      intakeDate: d(-88), kennelId: 'k5', origin: 'resgate', responsibleId: 'u4', lastVetVisit: d(-50), neutered: true,
      temperament: 'Observador. Gosta de janelas.',
    },
    {
      id: 'a19', name: 'Mingau', species: 'gato', breed: 'SRD', sex: 'macho', color: 'Branco e cinza', weightKg: 5.1,
      ageApproxMonths: 48, size: 'pequeno', status: 'disponivel', photo: photo('cat-04'),
      intakeDate: d(-120), kennelId: 'k5', origin: 'entrega_voluntaria', responsibleId: 'u4', lastVetVisit: d(-70), neutered: true,
      temperament: 'Adora caixas de papelão e colo.',
    },
    {
      id: 'a20', name: 'Pretinha', species: 'gato', breed: 'SRD', sex: 'femea', color: 'Preto e branco', weightKg: 1.3,
      ageApproxMonths: 3, size: 'pequeno', status: 'disponivel', photo: photo('cat-07'),
      intakeDate: d(-25), kennelId: 'k7', origin: 'nascido_abrigo', responsibleId: 'u4', lastVetVisit: d(-10), neutered: false,
      vetNotes: 'Castração a partir dos 5 meses (termo de compromisso na adoção).',
    },
    {
      id: 'a21', name: 'Nala', species: 'gato', breed: 'SRD', sex: 'femea', color: 'Creme', weightKg: 2.2,
      ageApproxMonths: 6, size: 'pequeno', status: 'disponivel', photo: photo('cat-09'),
      intakeDate: d(-40), kennelId: 'k7', origin: 'resgate', responsibleId: 'u4', lastVetVisit: d(-12), neutered: true,
    },
    {
      id: 'a22', name: 'Tom', species: 'gato', breed: 'SRD', sex: 'macho', color: 'Cinza tigrado', weightKg: 4.9,
      ageApproxMonths: 60, size: 'pequeno', status: 'tratamento', photo: photo('cat-12'),
      intakeDate: d(-45), kennelId: 'k6', origin: 'resgate', responsibleId: 'u2', lastVetVisit: d(-6), neutered: true,
      diseases: 'Esporotricose', vetNotes: 'Isolado. Manipular somente com luvas. Tratamento prolongado com itraconazol.',
    },
    // Adotados
    {
      id: 'a23', name: 'Bob', species: 'cao', breed: 'Pequinês', sex: 'macho', color: 'Branco e marrom', weightKg: 5.8,
      ageApproxMonths: 84, size: 'pequeno', status: 'adotado', photo: photo('dog-08-pekinese'),
      intakeDate: d(-95), origin: 'abandono', responsibleId: 'u3', lastVetVisit: d(-14), neutered: true,
      adoption: { adopterName: 'Cláudia Mendes', adopterPhone: '(65) 99812-4410', date: d(-5), notes: 'Visita de acompanhamento em 30 dias.' },
    },
    {
      id: 'a24', name: 'Neve', species: 'gato', breed: 'SRD', sex: 'femea', color: 'Branco', weightKg: 1.9,
      ageApproxMonths: 4, size: 'pequeno', status: 'adotado', photo: photo('cat-08'),
      intakeDate: d(-60), origin: 'nascido_abrigo', responsibleId: 'u4', lastVetVisit: d(-20), neutered: false,
      adoption: { adopterName: 'Thiago Barros', adopterPhone: '(65) 99645-2231', date: d(-12), notes: 'Assinou termo de castração.' },
    },
    {
      id: 'a25', name: 'Jade', species: 'cao', breed: 'SRD', sex: 'femea', color: 'Branco e preto', weightKg: 7.2,
      ageApproxMonths: 24, size: 'pequeno', status: 'adotado', photo: photo('dog-23-terrier-toy'),
      intakeDate: d(-80), origin: 'resgate', responsibleId: 'u3', lastVetVisit: d(-30), neutered: true,
      adoption: { adopterName: 'Renata Paes', adopterPhone: '(65) 99230-7788', date: d(-20) },
    },
    {
      id: 'a26', name: 'Lobinho', species: 'cao', breed: 'SRD', sex: 'macho', color: 'Cinza', weightKg: 18,
      ageApproxMonths: 40, size: 'grande', status: 'adotado', photo: photo('dog-37-elkhound-norwegian'),
      intakeDate: d(-160), origin: 'resgate', responsibleId: 'u3', lastVetVisit: d(-80), neutered: true,
      adoption: { adopterName: 'Marcos Vinícius Leal', adopterPhone: '(65) 99901-3345', date: d(-72) },
    },
    {
      id: 'a27', name: 'Frida', species: 'gato', breed: 'SRD', sex: 'femea', color: 'Laranja tigrado', weightKg: 3.8,
      ageApproxMonths: 18, size: 'pequeno', status: 'adotado', photo: photo('cat-13'),
      intakeDate: d(-150), origin: 'resgate', responsibleId: 'u4', lastVetVisit: d(-110), neutered: true,
      adoption: { adopterName: 'Aline Carvalho', adopterPhone: '(65) 99118-5520', date: d(-104) },
    },
    {
      id: 'a28', name: 'Biscoito', species: 'cao', breed: 'SRD', sex: 'macho', color: 'Caramelo', weightKg: 9,
      ageApproxMonths: 14, size: 'medio', status: 'adotado', photo: photo('dog-21-pomeranian'),
      intakeDate: d(-180), origin: 'abandono', responsibleId: 'u3', lastVetVisit: d(-140), neutered: true,
      adoption: { adopterName: 'Juliana Freitas', adopterPhone: '(65) 99734-1180', date: d(-135) },
    },
  ];
  const animals: Animal[] = raw.map((a) => ({ ...a, neutered: a.neutered ?? false, updatedAt: nowIso }));

  const treatments: AnimalTreatment[] = [
    { id: 't01', animalId: 'a07', title: 'Tratamento de erliquiose', medication: 'Doxiciclina 100 mg', dosage: '1 comprimido a cada 12h', startDate: d(-16), endDate: d(12), status: 'ativo', vet: 'Dra. Camila Rezende' },
    { id: 't02', animalId: 'a08', title: 'Dermatite alérgica', medication: 'Banho com clorexidina 2%', dosage: '1x por semana', startDate: d(-30), endDate: d(30), status: 'ativo', vet: 'Dra. Camila Rezende', notes: 'Manter ração hipoalergênica.' },
    { id: 't03', animalId: 'a08', title: 'Controle de artrose', medication: 'Condroitina + glucosamina', dosage: '1 comprimido ao dia', startDate: d(-60), status: 'ativo', vet: 'Dra. Camila Rezende' },
    { id: 't04', animalId: 'a09', title: 'Retirada de pontos (pós-castração)', startDate: d(0), status: 'pendente', vet: 'Dra. Camila Rezende' },
    { id: 't05', animalId: 'a09', title: 'Analgesia pós-operatória', medication: 'Meloxicam 2 mg', dosage: '1x ao dia', startDate: d(-8), endDate: d(-3), status: 'concluido', vet: 'Dra. Camila Rezende' },
    { id: 't06', animalId: 'a22', title: 'Esporotricose', medication: 'Itraconazol 100 mg', dosage: '1 cápsula ao dia com alimento', startDate: d(-40), endDate: d(50), status: 'ativo', vet: 'Dra. Camila Rezende', notes: 'Manipular com luvas. Isolamento.' },
    { id: 't07', animalId: 'a01', title: 'Castração', startDate: d(3), status: 'pendente', vet: 'Dra. Camila Rezende', notes: 'Mutirão de castração da Prefeitura.' },
    { id: 't08', animalId: 'a17', title: 'Hemograma e vermifugação de entrada', startDate: d(-1), status: 'pendente', vet: 'Dra. Camila Rezende' },
    { id: 't09', animalId: 'a14', title: 'Investigação de gastrite', medication: 'Omeprazol 10 mg', dosage: '1x ao dia em jejum', startDate: d(-2), status: 'ativo', vet: 'Dra. Camila Rezende' },
    { id: 't10', animalId: 'a11', title: 'Quarentena de entrada', startDate: d(-4), endDate: d(6), status: 'ativo', vet: 'Dra. Camila Rezende' },
  ];

  const v = (id: string, animalId: string, name: string, date: number, nextDue?: number): AnimalVaccine => ({
    id, animalId, name, date: d(date), nextDue: nextDue === undefined ? undefined : d(nextDue), vet: 'Dra. Camila Rezende',
  });
  const vaccines: AnimalVaccine[] = [
    v('v01', 'a01', 'V10 (polivalente)', -60, 305), v('v02', 'a01', 'Antirrábica', -60, 305),
    v('v03', 'a02', 'V10 (polivalente)', -358, 4), v('v04', 'a02', 'Antirrábica', -140, 225),
    v('v05', 'a03', 'V10 (polivalente)', -85, 280), v('v06', 'a03', 'Antirrábica', -85, 280),
    v('v07', 'a04', 'V10 (polivalente)', -50, 315),
    v('v08', 'a05', 'V10 (polivalente)', -30, 335),
    v('v09', 'a06', 'V10 (polivalente)', -370, -5), v('v10', 'a06', 'Antirrábica', -200, 165),
    v('v11', 'a08', 'V10 (polivalente)', -70, 295),
    v('v12', 'a10', 'V10 (polivalente)', -300, 65), v('v13', 'a10', 'Antirrábica', -300, 65),
    v('v14', 'a12', 'V10 (polivalente)', -105, 260),
    v('v15', 'a13', 'V10 (polivalente)', -45, 320),
    v('v16', 'a16', 'V10 (polivalente)', -250, 115),
    v('v17', 'a18', 'V4 felina', -85, 280), v('v18', 'a18', 'Antirrábica', -85, 280),
    v('v19', 'a19', 'V4 felina', -115, 250),
    v('v20', 'a20', 'V4 felina (1ª dose)', -21, 0),
    v('v21', 'a21', 'V4 felina (2ª dose)', -12, 9),
    v('v22', 'a22', 'V4 felina', -40, 325),
    v('v23', 'a15', 'V10 (polivalente)', -55, 310),
    v('v24', 'a09', 'V10 (polivalente)', -22, 343),
    // Doses anteriores (histórico)
    v('v25', 'a02', 'V10 (polivalente)', -723, -358), v('v26', 'a06', 'V10 (polivalente)', -735, -370),
    v('v27', 'a06', 'Antirrábica', -565, -200), v('v28', 'a10', 'V10 (polivalente)', -665, -300),
    v('v29', 'a21', 'V4 felina (1ª dose)', -33, -12),
  ];

  const healthRecords: AnimalHealthRecord[] = [
    { id: 'h01', animalId: 'a07', date: d(-18), type: 'exame', title: 'Hemograma completo', description: 'Trombocitopenia (plaquetas 68.000/µL). Teste rápido positivo para Ehrlichia.', vet: 'Dra. Camila Rezende' },
    { id: 'h02', animalId: 'a07', date: d(-4), type: 'consulta', title: 'Reavaliação', description: 'Mais ativa, apetite normal. Mucosas coradas.', vet: 'Dra. Camila Rezende' },
    { id: 'h03', animalId: 'a09', date: d(-8), type: 'cirurgia', title: 'Orquiectomia (castração)', description: 'Procedimento sem intercorrências.', vet: 'Dra. Camila Rezende' },
    { id: 'h04', animalId: 'a08', date: d(-9), type: 'consulta', title: 'Retorno dermatológico', description: 'Melhora das lesões no dorso. Manter protocolo.', vet: 'Dra. Camila Rezende' },
    { id: 'h05', animalId: 'a14', date: d(-2), type: 'consulta', title: 'Apatia e inapetência', description: 'Abdômen sensível à palpação. Solicitados ultrassom e bioquímico.', vet: 'Dra. Camila Rezende' },
    { id: 'h06', animalId: 'a14', date: d(-2), type: 'exame', title: 'Ultrassom abdominal', description: 'Aguardando laudo.', vet: 'Dra. Camila Rezende' },
    { id: 'h07', animalId: 'a22', date: d(-45), type: 'exame', title: 'Citologia de lesão', description: 'Compatível com Sporothrix spp.', vet: 'Dra. Camila Rezende' },
    { id: 'h08', animalId: 'a22', date: d(-6), type: 'consulta', title: 'Acompanhamento', description: 'Lesão do focinho em cicatrização.', vet: 'Dra. Camila Rezende' },
    { id: 'h09', animalId: 'a01', date: d(-21), type: 'consulta', title: 'Check-up', description: 'Clinicamente saudável. Apto para castração.', vet: 'Dra. Camila Rezende' },
    { id: 'h10', animalId: 'a11', date: d(-4), type: 'observacao', title: 'Avaliação de entrada', description: 'Escore corporal 4/9. Sem ectoparasitas. Iniciada quarentena.', vet: 'Dra. Camila Rezende' },
    { id: 'h11', animalId: 'a03', date: d(-15), type: 'consulta', title: 'Avaliação pré-adoção', description: 'Apta para adoção.', vet: 'Dra. Camila Rezende' },
  ];

  const statusLabel: Record<string, string> = {
    disponivel: 'Disponível para adoção', tratamento: 'Em tratamento', observacao: 'Em observação',
    reservado: 'Reservado', adotado: 'Adotado', atencao: 'Necessita atenção',
  };
  const events: AnimalEvent[] = [];
  let ev = 0;
  for (const a of animals) {
    const k = kennels.find((x) => x.id === a.kennelId);
    events.push({ id: `e${++ev}`, animalId: a.id, at: `${a.intakeDate}T09:30:00`, type: 'entrada', text: `Entrada na ONG${k ? ` · alocado em ${kennelPath(k)}` : ''}`, userId: a.responsibleId });
    if (a.status !== 'observacao') {
      const when = a.adoption ? a.adoption.date : a.lastVetVisit ?? a.intakeDate;
      if (a.status === 'adotado' && a.adoption) {
        events.push({ id: `e${++ev}`, animalId: a.id, at: `${subDaysIso(a.adoption.date, 7)}T15:00:00`, type: 'status', text: 'Status alterado para Reservado', userId: 'u1' });
        events.push({ id: `e${++ev}`, animalId: a.id, at: `${when}T16:10:00`, type: 'adocao', text: `Adotado por ${a.adoption.adopterName}`, userId: 'u1' });
      } else {
        events.push({ id: `e${++ev}`, animalId: a.id, at: `${when}T11:00:00`, type: 'status', text: `Status alterado para ${statusLabel[a.status]}`, userId: a.responsibleId });
      }
    }
  }
  events.push({ id: `e${++ev}`, animalId: 'a03', at: dt(-2, '10:20'), type: 'nota', text: 'Entrevista com a família interessada (Sr. Paulo e Sra. Denise). Visita agendada.', userId: 'u1' });
  events.push({ id: `e${++ev}`, animalId: 'a14', at: dt(-2, '08:05'), type: 'nota', text: 'Não comeu a ração da manhã pelo 3º dia seguido. Encaminhado para avaliação.', userId: 'u3' });

  // ─── Hotelzinho ──────────────────────────────────────────────
  const addr = (street: string, number: string, district: string, zip: string, complement?: string) => ({
    street, number, complement, district, city: 'Cuiabá', state: 'MT', zip,
  });
  const clients: Client[] = [
    { id: 'c1', name: 'Beatriz Albuquerque', cpf: makeCpf('529982247'), phone: '(65) 99214-3380', whatsapp: '(65) 99214-3380', email: 'beatriz.alb@gmail.com', address: addr('Rua das Orquídeas', '215', 'Jardim Itália', '78060-758'), notes: 'Viaja a trabalho com frequência. Prefere contato por WhatsApp.', createdAt: d(-300) },
    { id: 'c2', name: 'Fernando Tavares', cpf: makeCpf('112233445'), phone: '(65) 3624-1177', whatsapp: '(65) 99633-0921', email: 'fernando.tavares@outlook.com', address: addr('Av. Historiador Rubens de Mendonça', '1856', 'Bosque da Saúde', '78050-000', 'Apto 902'), createdAt: d(-210) },
    { id: 'c3', name: 'Luciana Magalhães', cpf: makeCpf('987654321'), phone: '(65) 99871-4402', whatsapp: '(65) 99871-4402', email: 'lu.magalhaes@gmail.com', address: addr('Rua Estevão de Mendonça', '640', 'Goiabeiras', '78032-010'), notes: 'Duas cadelas; hospedar sempre juntas quando possível.', createdAt: d(-180) },
    { id: 'c4', name: 'Ricardo Figueiredo', cpf: makeCpf('314159265'), phone: '(65) 99118-7065', whatsapp: '(65) 99118-7065', email: 'ricardo.fig@yahoo.com.br', address: addr('Rua Tenente Alcides Duarte', '88', 'Jardim das Américas', '78060-600'), createdAt: d(-90) },
    { id: 'c5', name: 'Patrícia Nogueira', cpf: makeCpf('271828182'), phone: '(65) 99456-2290', whatsapp: '(65) 99456-2290', email: 'patricia.nog@gmail.com', address: addr('Rua Barão de Melgaço', '3120', 'Centro Sul', '78020-800', 'Casa 2'), createdAt: d(-400) },
    { id: 'c6', name: 'André Carvalho', cpf: makeCpf('161803398'), phone: '(65) 99302-6618', whatsapp: '(65) 99302-6618', address: addr('Rua Presidente Marques', '455', 'Duque de Caxias', '78043-300'), notes: 'Autoriza banho durante a hospedagem.', createdAt: d(-60) },
    { id: 'c7', name: 'Sônia Ribeiro', cpf: makeCpf('141421356'), phone: '(65) 3052-8840', whatsapp: '(65) 99980-1123', email: 'sonia.ribeiro@hotmail.com', address: addr('Av. Fernando Corrêa da Costa', '2300', 'Boa Esperança', '78068-600'), createdAt: d(-250) },
    { id: 'c8', name: 'Gustavo Lemos', cpf: makeCpf('223606797'), phone: '(65) 99766-5501', whatsapp: '(65) 99766-5501', email: 'gustavo.lemos@gmail.com', address: addr('Rua Joaquim Murtinho', '1010', 'Porto', '78020-290'), createdAt: d(-20) },
    { id: 'c9', name: 'Helena Duarte', cpf: makeCpf('173205080'), phone: '(65) 99541-7730', whatsapp: '(65) 99541-7730', address: addr('Rua Cândido Mariano', '77', 'Centro Norte', '78005-150'), createdAt: d(-8) },
  ];

  const pets: ClientPet[] = [
    { id: 'p1', clientId: 'c1', name: 'Zeus', species: 'cao', breed: 'Husky Siberiano', sex: 'macho', color: 'Cinza e branco', weightKg: 24, ageYears: 5, size: 'grande', photo: photo('dog-12-husky'), vaccines: 'V10 e antirrábica em dia (mar/2026)', feeding: 'Ração Premier Raças Específicas, 350 g/dia em 2 refeições', behavior: 'Tenta fugir. Muro alto e porta sempre fechada.', notes: 'Sente muito calor: manter em área com ventilador.' },
    { id: 'p2', clientId: 'c1', name: 'Mia', species: 'gato', breed: 'SRD', sex: 'femea', color: 'Cinza tigrado', weightKg: 4.1, ageYears: 7, size: 'pequeno', photo: photo('cat-03'), vaccines: 'V4 e antirrábica em dia', feeding: 'Sachê à noite + ração seca à vontade', behavior: 'Tímida, se esconde nos primeiros dias.' },
    { id: 'p3', clientId: 'c2', name: 'Batata', species: 'cao', breed: 'Buldogue Francês', sex: 'macho', color: 'Branco', weightKg: 12.5, ageYears: 4, size: 'pequeno', photo: photo('dog-29-bulldog-french'), vaccines: 'V10 em dia; antirrábica vence em out/2026', allergies: 'Dermatite atópica', medications: 'Apoquel 5,4 mg, 1x ao dia', feeding: 'Ração hipoalergênica, 180 g/dia', behavior: 'Braquicefálico: evitar exercício no calor.' },
    { id: 'p4', clientId: 'c3', name: 'Lola', species: 'cao', breed: 'Galgo Italiano', sex: 'femea', color: 'Cinza', weightKg: 5.2, ageYears: 3, size: 'pequeno', photo: photo('dog-09-greyhound-italian'), vaccines: 'Em dia', feeding: 'Ração Super Premium, 90 g/dia', behavior: 'Sente frio à noite. Usa roupinha.', notes: 'Trazer a roupinha rosa.' },
    { id: 'p5', clientId: 'c3', name: 'Princesa', species: 'cao', breed: 'Galgo Afegão', sex: 'femea', color: 'Dourado', weightKg: 25, ageYears: 6, size: 'grande', photo: photo('dog-06-hound-afghan'), vaccines: 'Em dia', feeding: 'Ração Super Premium, 320 g/dia', behavior: 'Calma. Escovação diária.' },
    { id: 'p6', clientId: 'c4', name: 'Floquinho', species: 'cao', breed: 'Samoieda', sex: 'macho', color: 'Branco', weightKg: 21, ageYears: 2, size: 'grande', photo: photo('dog-10-samoyed'), vaccines: 'V10 e antirrábica em dia', feeding: 'Ração Premium, 300 g/dia', behavior: 'Muito sociável, pode ficar em baia coletiva.' },
    { id: 'p7', clientId: 'c5', name: 'Pipoca', species: 'cao', breed: 'Spitz Alemão', sex: 'femea', color: 'Laranja', weightKg: 3.1, ageYears: 8, size: 'pequeno', photo: photo('dog-21-pomeranian'), vaccines: 'Em dia', medications: 'Colírio lubrificante 2x ao dia', feeding: 'Ração Pequeno Porte Sênior, 60 g/dia', behavior: 'Late para cães grandes.' },
    { id: 'p8', clientId: 'c5', name: 'Garfield', species: 'gato', breed: 'SRD', sex: 'macho', color: 'Laranja', weightKg: 6.3, ageYears: 9, size: 'pequeno', vaccines: 'V4 em dia', feeding: 'Ração Light, porção controlada (55 g/dia)', behavior: 'Tranquilo.', notes: 'Obeso: não oferecer petiscos.' },
    { id: 'p9', clientId: 'c6', name: 'Bento', species: 'cao', breed: 'Cavalier King Charles', sex: 'macho', color: 'Branco e castanho', weightKg: 7.8, ageYears: 5, size: 'pequeno', photo: photo('dog-13-spaniel-blenheim'), vaccines: 'Em dia', medications: 'Pimobendan 1,25 mg a cada 12h (cardiopata)', feeding: 'Ração Cardiac, 120 g/dia', behavior: 'Dócil.', notes: 'Monitorar respiração em repouso.' },
    { id: 'p10', clientId: 'c7', name: 'Pudim', species: 'cao', breed: 'Basset Hound', sex: 'macho', color: 'Tricolor', weightKg: 23, ageYears: 6, size: 'medio', photo: photo('dog-40-hound-basset'), vaccines: 'Em dia', feeding: 'Ração Premium, 280 g/dia', behavior: 'Uiva quando fica sozinho.' },
    { id: 'p11', clientId: 'c8', name: 'Loki', species: 'cao', breed: 'SRD', sex: 'macho', color: 'Preto', weightKg: 16, ageYears: 3, size: 'medio', vaccines: 'Em dia', feeding: 'Ração Premium, 220 g/dia', behavior: 'Reativo com outros machos.' },
    { id: 'p12', clientId: 'c9', name: 'Paçoquinha', species: 'gato', breed: 'SRD', sex: 'femea', color: 'Caramelo', weightKg: 3.4, ageYears: 2, size: 'pequeno', feeding: 'Ração seca à vontade' },
  ];

  const accommodations: Accommodation[] = [
    { id: 'ac1', name: 'Suíte individual', description: 'Espaço fechado para um cão, com cama e ventilador.', species: 'cao', capacity: 6, dailyRate: 85 },
    { id: 'ac2', name: 'Baia coletiva', description: 'Para cães sociáveis de pequeno e médio porte.', species: 'cao', capacity: 4, dailyRate: 60 },
    { id: 'ac3', name: 'Gatil', description: 'Nichos individuais em ambiente separado dos cães.', species: 'gato', capacity: 4, dailyRate: 55 },
  ];

  let bk = 0;
  const b = (petId: string, accommodationId: string, from: number, to: number, status: Booking['status'], extra: Partial<Booking> = {}): Booking => {
    bk += 1;
    const acc = accommodations.find((a) => a.id === accommodationId)!;
    return {
      id: `b${bk}`, code: `H-${String(1040 + bk)}`, petId, accommodationId, checkIn: d(from), checkOut: d(to), status,
      dailyRate: acc.dailyRate, createdAt: `${d(Math.min(from - 7, -1))}T10:00:00`, ...extra,
    };
  };
  const bookings: Booking[] = [
    b('p5', 'ac1', -170, -163, 'finalizada'),
    b('p10', 'ac1', -150, -146, 'finalizada'),
    b('p1', 'ac1', -128, -120, 'finalizada'),
    b('p7', 'ac2', -101, -95, 'finalizada'),
    b('p6', 'ac2', -80, -75, 'finalizada'),
    b('p1', 'ac1', -60, -55, 'finalizada'),
    b('p10', 'ac1', -45, -40, 'finalizada'),
    b('p5', 'ac1', -35, -28, 'finalizada'),
    b('p8', 'ac3', -20, -14, 'finalizada'),
    b('p3', 'ac1', -15, -12, 'cancelada', { cancelReason: 'Tutor cancelou a viagem.' }),
    b('p9', 'ac1', -9, -6, 'finalizada'),
    b('p1', 'ac1', -6, 0, 'hospedado', { specialNeeds: 'Área ventilada; muro alto (histórico de fuga).' }),
    b('p3', 'ac1', -3, 0, 'hospedado', { specialNeeds: 'Apoquel 1x ao dia pela manhã.' }),
    b('p4', 'ac2', -2, 3, 'hospedado', { notes: 'Usar roupinha à noite.' }),
    b('p2', 'ac3', -4, 1, 'hospedado'),
    b('p7', 'ac2', -1, 5, 'hospedado', { specialNeeds: 'Colírio 2x ao dia.' }),
    b('p6', 'ac2', 0, 4, 'confirmada'),
    b('p9', 'ac1', 2, 9, 'reserva', { specialNeeds: 'Cardiopata: Pimobendan a cada 12h. Monitorar respiração.' }),
    b('p10', 'ac1', 5, 8, 'confirmada'),
    b('p11', 'ac1', 12, 20, 'reserva', { notes: 'Não colocar próximo de outros machos.' }),
    b('p12', 'ac3', 18, 22, 'reserva'),
  ];

  const staff = ['u3', 'u4', 'u1'];
  const checkins: BookingCheckin[] = [];
  const checkouts: BookingCheckout[] = [];
  bookings.forEach((bo, i) => {
    if (bo.status === 'hospedado' || bo.status === 'finalizada') {
      const pet = pets.find((p) => p.id === bo.petId)!;
      checkins.push({
        bookingId: bo.id, at: `${bo.checkIn}T0${8 + (i % 2)}:${i % 2 ? '40' : '15'}:00`, userId: staff[i % staff.length], condition: 'boa',
        items: pet.species === 'gato' ? ['Caixa de transporte', 'Ração'] : ['Coleira', 'Guia', 'Ração', ...(i % 3 === 0 ? ['Cama'] : [])],
        feeding: pet.feeding, medications: pet.medications, notes: i % 4 === 0 ? 'Chegou tranquilo.' : undefined,
      });
    }
    if (bo.status === 'finalizada') {
      const nights = Math.max(1, daysBetween(bo.checkIn, bo.checkOut));
      checkouts.push({
        bookingId: bo.id, at: `${bo.checkOut}T17:${10 + (i % 4) * 10}:00`, userId: staff[(i + 1) % staff.length], condition: 'boa',
        finalValue: nights * bo.dailyRate + (i % 3 === 0 ? 45 : 0), notes: i % 3 === 0 ? 'Incluído banho de saída (R$ 45).' : undefined,
      });
    }
  });

  return {
    version: SEED_VERSION,
    organization: { name: 'Associação LUNAAR', city: 'Cuiabá – MT', phone: '(65) 99246-5672', pix: '(65) 99246-5672' },
    users, kennels, animals, treatments, vaccines, healthRecords, events, clients, pets, accommodations, bookings, checkins, checkouts,
  };

  function subDaysIso(date: string, n: number) {
    return format(subDays(new Date(`${date}T12:00:00`), n), 'yyyy-MM-dd');
  }
}

function daysBetween(a: string, b: string) {
  return Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86_400_000);
}
