<?php

class Sns_Toronto_Model_System_Config_Source_ListLayout
{
	public function toOptionArray()
	{
		return array(
			array('value'=>'1', 'label'=>Mage::helper('toronto')->__('Full width')),
			array('value'=>'2', 'label'=>Mage::helper('toronto')->__('Boxed')),
		);
	}
}
