import { type ActionFunctionArgs } from '@remix-run/node';
import { Form, useLoaderData } from '@remix-run/react';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import electron from '~/electron.server';
import * as XLSX from 'xlsx';
import { useState, ChangeEvent } from 'react';
import { Button } from '~/components/ui/button';

type SheetData = { [key: string]: any };

export function loader() {
  return {
    userDataPath: electron.app.getPath('userData'),
  };
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const form = await request.formData();
  const data = JSON.parse(form.get('data') as string);
  console.log(data[1]);
  return null;
};

export default function Index() {
  const dataFromLoader = useLoaderData<typeof loader>();
  const [data, setData] = useState<SheetData[]>([]);
  console.log(data);

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsBinaryString(file);
    reader.onload = (event: ProgressEvent<FileReader>) => {
      const binaryStr = event.target?.result;
      if (typeof binaryStr === 'string') {
        const workbook = XLSX.read(binaryStr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const parsedData: SheetData[] = XLSX.utils.sheet_to_json(sheet, { range: 3, header: 'A' });
        setData(parsedData);
      }
    };
  };

  return (
    <main className="flex flex-col gap-y-5">
      <h1 className="p-3 font-bold">Welcome to Remix</h1>
      <p>User data path: {dataFromLoader.userDataPath}</p>
      <div className="flex gap-x-5 items-end justify-center">
        <div className="grid w-full max-w-sm items-center gap-1.5">
          <Label htmlFor="excel">Excel template</Label>
          <Input
            id="excel"
            type="file"
            accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            onChange={handleFileUpload}
          />
        </div>
      </div>
      {data.length > 0 && (
        <p className="flex gap-x-3 justify-center">
          Loaded jobs: <pre>{data.length}</pre>
        </p>
      )}
      <Form method="post">
        <input hidden name="data" type="text" value={JSON.stringify(data)} />
        <Button type="submit">Submit</Button>
      </Form>
    </main>
  );
}
