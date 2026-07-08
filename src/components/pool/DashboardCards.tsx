import {
    Car,
    Ticket,
    Fuel,
    Gauge,
    DollarSign,
    CheckCircle,
    XCircle
} from "lucide-react";

interface DashboardCardsProps {

    cards: {

        totalVouchers: number;

        custoTotal: number;

        custoMedio: number;

        kmTotal: number;

        litrosTotal: number;

        consumoMedio: number;

        disponiveis: number;

        indisponiveis: number;

        disponibilidadeFisica: number;

    };

}

interface CardProps {

    titulo: string;

    valor: string | number;

    icon: React.ReactNode;

}

function Card({

    titulo,

    valor,

    icon

}: CardProps) {

    return (

        <div className="bg-white rounded-xl shadow-sm border p-5">

            <div className="flex justify-between items-center">

                <div>

                    <div className="text-sm text-gray-500">

                        {titulo}

                    </div>

                    <div className="text-3xl font-bold mt-2">

                        {valor}

                    </div>

                </div>

                <div className="text-blue-600">

                    {icon}

                </div>

            </div>

        </div>

    );

}

export default function DashboardCards({

    cards

}: DashboardCardsProps) {

    return (

        <div className="grid grid-cols-4 gap-5">

            <Card

                titulo="Quantidade de Vouchers"

                valor={cards.totalVouchers}

                icon={<Ticket size={36} />}

            />

            <Card

                titulo="Custo Total"

                valor={cards.custoTotal.toLocaleString(

                    "pt-BR",

                    {

                        style: "currency",

                        currency: "BRL"

                    }

                )}

                icon={<DollarSign size={36} />}

            />

            <Card

                titulo="Valor Médio"

                valor={cards.custoMedio.toLocaleString(

                    "pt-BR",

                    {

                        style: "currency",

                        currency: "BRL"

                    }

                )}

                icon={<DollarSign size={36} />}

            />

            <Card

                titulo="KM Rodados"

                valor={cards.kmTotal.toLocaleString("pt-BR")}

                icon={<Car size={36} />}

            />

            <Card

                titulo="Litros Consumidos"

                valor={cards.litrosTotal.toLocaleString("pt-BR")}

                icon={<Fuel size={36} />}

            />

            <Card

                titulo="Consumo Médio"

                valor={`${cards.consumoMedio.toFixed(2)} km/L`}

                icon={<Gauge size={36} />}

            />

            <Card

                titulo="Disponíveis"

                valor={cards.disponiveis}

                icon={<CheckCircle size={36} />}

            />

            <Card

                titulo="Indisponíveis"

                valor={cards.indisponiveis}

                icon={<XCircle size={36} />}

            />

            <div className="col-span-4 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl text-white p-6">

                <div className="text-lg">

                    Disponibilidade Física da Frota

                </div>

                <div className="text-5xl font-bold mt-2">

                    {cards.disponibilidadeFisica.toFixed(1)}%

                </div>

                <div className="mt-2 opacity-80">

                    Percentual de veículos disponíveis para operação.

                </div>

            </div>

        </div>

    );

}
