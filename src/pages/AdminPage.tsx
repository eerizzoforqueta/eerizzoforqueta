import * as React from 'react'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import CssBaseline from '@mui/material/CssBaseline'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import MenuIcon from '@mui/icons-material/Menu'
import HomeIcon from '@mui/icons-material/Home'
import GroupAddIcon from '@mui/icons-material/GroupAdd'
import SettingsIcon from '@mui/icons-material/Settings'
import ListAltIcon from '@mui/icons-material/ListAlt'
import UpdateIcon from '@mui/icons-material/Update'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Image from 'next/image'
import { Avatar, Grid } from '@mui/material'
import { TurmasInfoTableNoSSR } from '@/components/AdminPageTable/DynamicComponents'
import Link from 'next/link'
import { GetServerSideProps } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from './api/auth/[...nextauth]'
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd'
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import AutoDeleteIcon from '@mui/icons-material/AutoDelete';
import ChangeCircleIcon from '@mui/icons-material/ChangeCircle';
import AvisosFaltasConsecutivas from '@/components/AvisosFaltasConsecutivas'

const drawerWidth = 280
export default function AdminPage() {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [isClosing, setIsClosing] = React.useState(false)

  const handleDrawerClose = () => {
    setIsClosing(true)
    setMobileOpen(false)
  }

  const handleDrawerTransitionEnd = () => {
    setIsClosing(false)
  }

  
  const handleDrawerToggle = () => {
    if (!isClosing) {
      setMobileOpen(!mobileOpen)
    }
  }
//
const drawer = (
  <Box sx={{ width: drawerWidth, flexShrink: 0, bgcolor: '#f4f4f4' }}>
    <Toolbar />
    <Box sx={{ pb: '2.3rem' }}>
      <Avatar
        sx={{
          height: 80,
          position: 'absolute',
          top: '10px',
          left: '80px',
          width: '50%',
          backgroundColor: '#f4f4f4',
        }}
      >
        <Image
          src="https://firebasestorage.googleapis.com/v0/b/imagens-9116b.appspot.com/o/logoescolinha-removebg-preview(1).png?alt=media&token=c33b14a0-c768-45a1-926f-94b85770f27b"
          alt="Logo"
          layout="fill"
          objectFit="contain"
        />
      </Avatar>
    </Box>
    <Divider />
    <List sx={{ padding: 0 }}>
      {[
        { icon: <HomeIcon color="primary" />, text: 'Página Inicial', href: '/' },
        { icon: <GroupAddIcon color="secondary" />, text: 'Cadastrar alunos', href: '/StudentRegistration' },
         { icon: <GroupAddIcon color="success" />, text: 'Painel de Controle de rematriculas', href: '/rematricula/rematriculasAdmControl' },
        { icon: <AssignmentIndIcon color="info" />, text: 'Portal da rematricula', href: '/rematricula/PortalDaRematricula ' },
        { icon: <SettingsIcon color="error" />, text: 'Trocar aluno de turma', href: '/StudentUpdateTurmas' },
        { icon: <ListAltIcon color="action" />, text: 'Listas de chamada', href: '/StudentPresenceTable' },
        { icon: <UpdateIcon color="disabled" />, text: 'Atualização cadastral', href: '/StudentUpdatePersonalInformation' },
        { icon: <AssignmentIndIcon color="info" />, text: 'Lista geral de alunos', href: '/ListOfAllStudents' },
        { icon: <FileDownloadIcon color="success" />, text: 'Controle de uniformes', href: '/StudantUniformTable' },
        { icon: <ErrorOutlineIcon color="warning" />, text: 'Verificação e correção', href: '/AjusteDadosTurmas' },
        { icon: <AutoDeleteIcon color="error" />, text: 'Arquivar/Deletar alunos', href: '/ArquivarAlunos' },
        { icon: <ChangeCircleIcon color="warning" />, text: 'Trocar Semestre', href: '/MudarSemestre' },
        { icon: <FileDownloadIcon color="success" />, text: 'Criação/Atualização de turmas', href: '/HandleTurmas' },
      ].map((item, index) => (
        <React.Fragment key={index}>
          <ListItem disablePadding sx={{ '&:hover': { bgcolor: '#e0e0e0' } }}>
            {/* 👇 aqui o segredo: ListItemButton vira Link */}
            <ListItemButton
              component={Link}
              href={item.href}
              sx={{ textDecoration: 'none', color: 'inherit' }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText
                primary={
                  <Typography sx={{ fontSize: '1.1rem' }}>
                    {item.text}
                  </Typography>
                }
              />
            </ListItemButton>
          </ListItem>

          {index < 9 && <Divider variant="inset" component="li" />}
        </React.Fragment>
      ))}
    </List>
  </Box>
);

  // Remove this const when copying and pasting into your project.
  // StudentTemporary
  return (
    <Box sx={{ display: 'flex' }}>
    <CssBaseline />
    <AppBar
      position="fixed"
      sx={{
        width: { sm: `calc(100% - ${drawerWidth}px)` },
        ml: { sm: `${drawerWidth}px` },
      }}
    >
      <Toolbar>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="start"
          onClick={handleDrawerToggle}
          sx={{ mr: 2, display: { sm: 'none' } }}
        >
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" noWrap component="div">
          Painel de Administrador
        </Typography>
      </Toolbar>
    </AppBar>
    <Box
      component="nav"
      sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      aria-label="mailbox folders"
    >
      {/* The implementation can be swapped with js to avoid SEO duplication of links. */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onTransitionEnd={handleDrawerTransitionEnd}
        onClose={handleDrawerClose}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
          },
        }}
      >
        {drawer}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
          },
        }}
        open
      >
        {drawer}
      </Drawer>
    </Box>
    <Box
      component="main"
      sx={{
        flexGrow: 1,
        p: 3,
        marginTop: '65px',
        width: { sm: `calc(100% - ${drawerWidth}px)` },
      }}
    >
      {/* Utilize o componente Grid para organizar os cartões em linha */}
      <Grid container spacing={2} justifyContent="center">
        {/* Cada cartão em um item de Grid */}

        <Box>
          <TurmasInfoTableNoSSR />
        </Box>
      </Grid>
      <Box sx={{ mt: 3 }}>
        <AvisosFaltasConsecutivas />
      </Box>
      <Toolbar />
    </Box>
  </Box>
  );
}
//  <TurmasInfoTableNoSSR />
export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions)

  // Se não tiver sessão ou não for admin, redirecione para a página de login
  if (!session || session.user.role !== 'admin') {
    return {
      redirect: {
        destination: '/NotAllowPage',
        permanent: false,
      },
    }
  }

  // Retornar props aqui se a permissão for válida
  return {
    props: {
      /* props adicionais aqui */
    },
  }
}
